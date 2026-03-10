// =============================================================================
// CONFIGURATION — only thing you ever need to touch
// =============================================================================
var SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
var PREFERRED_SHEET = 'Leads'; // Falls back to first sheet if not found

// =============================================================================
// FIELD ALIASES
// Maps frontend/payload key names → possible sheet column header variations.
// Add new aliases here if you rename a column and want backwards compatibility.
// The script will ALSO auto-match via normalized comparison (lowercase, alphanum),
// so most renames are handled automatically without touching this list.
// =============================================================================
var FIELD_ALIASES = {
  'customer'    : ['Customer', 'Company', 'Company Name', 'Name', 'Lead Name'],
  'contact'     : ['Customer Point of Contact', 'Contact', 'POC', 'Point of Contact'],
  'manager'     : ['Management Lead', 'Manager', 'Account Manager', 'Mgr'],
  'strategic'   : ['Strategic Owner', 'Strategic', 'Strategy Lead'],
  'delivery'    : ['Delivery Lead', 'Delivery', 'Delivery Manager'],
  'origin'      : ['Lead Origin', 'Origin', 'Source', 'Lead Source'],
  'logo'        : ['Logo URL', 'Logo', 'Company Logo'],
  'linkedin'    : ['LinkedIn', 'LinkedIn URL', 'Social', 'LinkedIn Profile'],
  'slides'      : ['Slides URL', 'Slides', 'Deck', 'Presentation URL'],
  'dead'        : ['Dead', 'Inactive', 'Lost', 'Closed Lost'],
  'successful'  : ['Successful', 'Client', 'Won', 'Closed Won', 'Converted'],
  'intro'       : ['Introductory Meeting', 'Intro Meeting', 'Intro Call', 'Intro'],
  'weekly'      : ['Weekly Calls', 'Weekly Call', 'Weekly Sync', 'Recurring Call'],
  'ppts'        : ['PPTs Shared', 'PPT Shared', 'PPTs', 'Presentation Shared', 'Deck Shared'],
  'verbal'      : ['Verbal Agreement', 'Verbal', 'Verbal Commit', 'Verbal Confirmation'],
  'nda'         : ['NDA Signed', 'NDA', 'Non-Disclosure Agreement', 'Confidentiality Agreement'],
  'loi_issued'  : ['LOI Issued', 'Letter of Intent Issued', 'LOI Sent'],
  'loi_signed'  : ['LOI Signed', 'Letter of Intent Signed', 'LOI Executed'],
  'contract'    : ['Contract Signed', 'Contract Executed', 'Contract', 'MSA Signed', 'Agreement Signed'],
  'parts'       : ['Parts & Spend Received', 'Parts Received', 'Parts and Spend', 'Parts', 'Spend Received'],
  'Current Progress': ['Current Progress', 'Notes', 'Progress Notes', 'Status Notes', 'Progress'],
  'type'        : ['PIM or CM', 'Type', 'Service Type', 'Engagement Type'],
};

// Fields that exist only in the frontend state — never write these to the sheet
var SKIP_FIELDS = ['action', 'id', 'score', 'progress', 'phase', 'tags', 'pipeline'];

// Default headers used when creating a brand-new sheet from scratch
var DEFAULT_HEADERS = [
  'Customer', 'Dead', 'Successful', 'Lead Origin', 'Customer Point of Contact',
  'Management Lead', 'Strategic Owner', 'Delivery Lead', 'Logo URL', 'LinkedIn',
  'Slides URL', 'PIM or CM', 'Introductory Meeting', 'Weekly Calls',
  'PPTs Shared', 'Verbal Agreement', 'NDA Signed', 'LOI Issued', 'LOI Signed',
  'Contract Signed', 'Parts & Spend Received', 'Current Progress'
];

// =============================================================================
// CORE HELPERS
// =============================================================================

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(PREFERRED_SHEET);
  if (!sheet) {
    // Fall back to first sheet
    sheet = ss.getSheets()[0];
  }
  return sheet;
}

// Normalize a string for fuzzy comparison: lowercase + alphanum only
function normalize(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Get all header values from row 1 (trimmed strings)
function getHeaders(sheet) {
  if (sheet.getLastRow() === 0) return [];
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h).trim();
  });
}

// Find 0-based index of a field in headers.
// Resolution order: exact → normalized → alias exact → alias normalized → -1
function findColumnIndex(headers, fieldName) {
  var normField = normalize(fieldName);

  // 1. Exact match
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === fieldName) return i;
  }
  // 2. Normalized match
  for (var i = 0; i < headers.length; i++) {
    if (normalize(headers[i]) === normField) return i;
  }
  // 3. Alias matches
  var aliases = FIELD_ALIASES[fieldName] || [];
  for (var j = 0; j < aliases.length; j++) {
    var normAlias = normalize(aliases[j]);
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] === aliases[j] || normalize(headers[i]) === normAlias) return i;
    }
  }
  return -1;
}

// Find a column (1-based). If not found, create it and return the new index.
function findOrCreateColumn(sheet, headers, fieldName) {
  var idx = findColumnIndex(headers, fieldName);
  if (idx !== -1) return idx + 1; // 1-based

  // Auto-create the column
  var newColIdx = headers.length + 1;
  sheet.getRange(1, newColIdx).setValue(fieldName);
  headers.push(fieldName); // keep in-memory headers in sync
  return newColIdx;
}

// Find customer row index (1-based, includes header offset).
// Returns -1 if not found.
function findCustomerRow(sheet, headers, customerName) {
  var colIdx = findColumnIndex(headers, 'customer');
  if (colIdx === -1) colIdx = findColumnIndex(headers, 'Customer');
  if (colIdx === -1) return -1;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var values = sheet.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
  var normTarget = normalize(customerName);
  for (var i = 0; i < values.length; i++) {
    if (normalize(values[i][0]) === normTarget) return i + 2; // 1-based
  }
  return -1;
}

// Coerce a value for writing to Sheets (booleans stay boolean, objects→JSON)
function coerceValue(value) {
  if (value === true || value === false) return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

// =============================================================================
// SELF-HEALING: initialise sheet headers if the sheet is empty
// =============================================================================

function ensureSheetHasHeaders(sheet) {
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, DEFAULT_HEADERS.length).setValues([DEFAULT_HEADERS]);
    // Freeze header row and make it bold
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, DEFAULT_HEADERS.length).setFontWeight('bold');
  }
}

// =============================================================================
// SETTINGS SHEET — reads Name (col A) + Email (col B) from "Settings" sheet
// =============================================================================

function getUsers() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Settings');
  if (!sheet || sheet.getLastRow() < 2) return [];

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  return rows
    .filter(function(r) { return r[0] && r[1]; })
    .map(function(r) { return { name: String(r[0]).trim(), email: String(r[1]).trim() }; });
}

// =============================================================================
// HTTP HANDLERS
// =============================================================================

function doGet(e) {
  try {
    var sheet = getSheet();
    var leads = readAllRows(sheet);
    var users = getUsers();
    return respond({ leads: leads, users: users });
  } catch (err) {
    return respondError(err);
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = String(payload.action || '').toLowerCase();
    var result;

    if      (action === 'create')    result = createRow(payload);
    else if (action === 'update')    result = updateRow(payload);
    else if (action === 'delete')    result = deleteRow(payload);
    else if (action === 'sendemail') result = sendEmailAction(payload);
    else return respondError(new Error('Unknown action: ' + action));

    return respond(result);
  } catch (err) {
    return respondError(err);
  }
}

// =============================================================================
// READ — return every non-empty row as a plain object keyed by header name
// =============================================================================

function readAllRows(sheet) {
  ensureSheetHasHeaders(sheet);
  var headers = getHeaders(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var lastCol = Math.max(headers.length, sheet.getLastColumn());
  var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return rows
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        obj[h] = row[i] !== undefined ? row[i] : '';
      });
      return obj;
    })
    .filter(function(obj) {
      // Drop rows where every cell is blank
      return Object.keys(obj).some(function(k) { return obj[k] !== ''; });
    });
}

// =============================================================================
// CREATE — add a new row, auto-initialising headers if needed
// =============================================================================

function createRow(payload) {
  var sheet = getSheet();
  ensureSheetHasHeaders(sheet);
  var headers = getHeaders(sheet);

  var customerName = payload.customer || payload.Customer || 'New Lead';

  // Guard: don't create duplicates
  if (findCustomerRow(sheet, headers, customerName) !== -1) {
    return { success: false, reason: 'Duplicate: customer already exists', customer: customerName };
  }

  var targetRow = sheet.getLastRow() + 1;
  var newRow = new Array(headers.length).fill('');

  // Set customer name
  var custIdx = findColumnIndex(headers, 'customer');
  if (custIdx !== -1) newRow[custIdx] = customerName;

  sheet.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);
  return { success: true, action: 'created', row: targetRow, customer: customerName };
}

// =============================================================================
// UPDATE — find row by customer name, write any payload fields
//           auto-creates new columns for unknown fields
// =============================================================================

function updateRow(payload) {
  var sheet = getSheet();
  ensureSheetHasHeaders(sheet);
  var headers = getHeaders(sheet);

  var customerName = payload.customer || payload.Customer;
  if (!customerName) return { success: false, reason: 'No customer name in payload' };

  var rowIndex = findCustomerRow(sheet, headers, customerName);
  if (rowIndex === -1) {
    // Self-heal: customer not found → create it, then update
    createRow(payload);
    headers = getHeaders(sheet); // refresh after possible new columns
    rowIndex = findCustomerRow(sheet, headers, customerName);
    if (rowIndex === -1) return { success: false, reason: 'Could not create row for: ' + customerName };
  }

  // Write each field in the payload
  Object.keys(payload).forEach(function(key) {
    if (SKIP_FIELDS.indexOf(key) !== -1) return;

    var colIdx = findOrCreateColumn(sheet, headers, key); // 1-based, creates if missing
    sheet.getRange(rowIndex, colIdx).setValue(coerceValue(payload[key]));
  });

  return { success: true, action: 'updated', row: rowIndex, customer: customerName };
}

// =============================================================================
// DELETE — remove a row entirely by customer name
// =============================================================================

function deleteRow(payload) {
  var sheet = getSheet();
  var headers = getHeaders(sheet);

  var customerName = payload.customer || payload.Customer;
  if (!customerName) return { success: false, reason: 'No customer name in payload' };

  var rowIndex = findCustomerRow(sheet, headers, customerName);
  if (rowIndex === -1) return { success: false, reason: 'Customer not found: ' + customerName };

  sheet.deleteRow(rowIndex);
  return { success: true, action: 'deleted', customer: customerName };
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function respondError(err) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: err.message }))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
// EMAIL — parse notes and send a formatted HTML email via Gmail
// =============================================================================

function parseNotesGS(notesStr) {
  if (!notesStr) return [];
  if (notesStr.indexOf('|||') !== -1) {
    return notesStr.split('\n===\n').map(function(entry) {
      var sep = entry.indexOf('|||');
      if (sep === -1) return null;
      var dateStr = entry.substring(0, sep);
      var content = entry.substring(sep + 3);
      var date = dateStr ? new Date(dateStr) : null;
      return { date: date, content: content };
    }).filter(Boolean);
  }
  return [{ date: null, content: notesStr }];
}

function formatDateGS(date) {
  if (!date || date.getTime() === 0) return 'Legacy Note';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a');
}

// Convert the stored markdown-ish syntax to basic HTML for the email body
function renderNoteContentGS(content) {
  return content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:8px 0">')
    .replace(/^[•\-] (.+)$/gm, '<div style="margin:2px 0">• $1</div>')
    .replace(/\n/g, '<br>');
}

function sendEmailAction(payload) {
  var customer       = payload.customer       || 'Unknown Lead';
  var recipientEmail = payload.recipientEmail || '';
  var recipientName  = payload.recipientName  || recipientEmail;
  var notesStr       = payload.notes          || '';

  if (!recipientEmail) return { success: false, reason: 'No recipient email' };

  var notes = parseNotesGS(notesStr);
  if (notes.length === 0) return { success: false, reason: 'No notes to send' };

  // Colour palette matching the frontend
  var colors = ['#2563eb','#7c3aed','#ea580c','#16a34a','#a21caf'];

  var notesHtml = notes.map(function(note, i) {
    var accent = colors[i % colors.length];
    var bg     = (i % 2 === 0) ? '#f8fafc' : '#ffffff';
    return [
      '<div style="border-left:3px solid ' + accent + '; background:' + bg + ';',
      'border-radius:0 8px 8px 0; padding:10px 14px; margin-bottom:10px;">',
      '<div style="font-size:11px; font-weight:700; color:' + accent + '; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.04em;">',
      formatDateGS(note.date),
      '</div>',
      '<div style="font-size:14px; line-height:1.6; color:#1e293b;">',
      renderNoteContentGS(note.content),
      '</div>',
      '</div>'
    ].join('');
  }).join('');

  var htmlBody = [
    '<div style="font-family:Inter,Helvetica,sans-serif; max-width:600px; margin:0 auto; color:#1e293b;">',
    '  <div style="background:#2563eb; border-radius:12px 12px 0 0; padding:20px 28px;">',
    '    <h2 style="margin:0; color:white; font-size:18px;">Notes &amp; Action Items</h2>',
    '    <p style="margin:4px 0 0; color:#bfdbfe; font-size:13px;">' + customer + '</p>',
    '  </div>',
    '  <div style="background:#ffffff; border:1px solid #e2e8f0; border-top:none;',
    '       border-radius:0 0 12px 12px; padding:20px 28px;">',
    '    <p style="margin:0 0 16px; font-size:13px; color:#64748b;">',
    '      Hi ' + recipientName.split(' ')[0] + ', here are the latest notes for <strong>' + customer + '</strong>:',
    '    </p>',
    notesHtml,
    '    <p style="margin:20px 0 0; font-size:11px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:14px;">',
    '      Sent from Sales Tracker',
    '    </p>',
    '  </div>',
    '</div>'
  ].join('\n');

  GmailApp.sendEmail(
    recipientEmail,
    'Notes & Action Items: ' + customer,
    // Plain-text fallback
    notes.map(function(n) { return (formatDateGS(n.date) + '\n' + n.content); }).join('\n\n---\n\n'),
    { htmlBody: htmlBody, name: 'Sales Tracker' }
  );

  return { success: true, recipient: recipientEmail, customer: customer };
}

// =============================================================================
// UTILITY — run this manually once from the Apps Script editor to verify setup
// =============================================================================

function testSetup() {
  var sheet = getSheet();
  Logger.log('Sheet found: ' + sheet.getName());
  Logger.log('Headers: ' + getHeaders(sheet).join(', '));
  Logger.log('Rows: ' + (sheet.getLastRow() - 1));
  Logger.log('Setup OK');
}
