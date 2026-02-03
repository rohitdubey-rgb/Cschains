// --- CONFIGURATION ---
var SPREADSHEET_FILE_ID = "1KjBMOmjl73pf2ZF6ZQHlvLBHHV3VlpO38UUhbTpmBzU"; 
var SHEET_TAB_ID = 0; 

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_FILE_ID);
    var sheet = getSheetById(ss, SHEET_TAB_ID);
    if (!sheet) return responseJSON({status: "error", message: "Sheet Tab not found."});

    // --- READ (GET) ---
    if (!e.postData) {
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var rows = data.slice(1);
      var result = rows.map(function(row) {
        var obj = {};
        headers.forEach(function(header, i) { obj[header] = row[i]; });
        return obj;
      });
      return responseJSON(result);
    }

    // --- WRITE (POST) ---
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || "update"; // Default to update
    
    var dataRange = sheet.getDataRange().getValues();
    var rowIndex = -1;

    // Find row index (except for create)
    if (action !== "create") {
      for (var i = 1; i < dataRange.length; i++) {
        if (String(dataRange[i][0]).trim().toLowerCase() == String(payload.customer).trim().toLowerCase()) { 
          rowIndex = i + 1; 
          break;
        }
      }
    }

    // --- CASE 1: DELETE ---
    if (action === "delete") {
      if (rowIndex === -1) return responseJSON({status: "error", message: "Customer not found."});
      sheet.deleteRow(rowIndex);
      return responseJSON({status: "success", message: "Deleted"});
    }

    // --- CASE 2: CREATE ---
    if (action === "create") {
      if (rowIndex !== -1) return responseJSON({status: "error", message: "Customer already exists."});
      // Append new row with Customer Name in Col A
      sheet.appendRow([payload.customer]); 
      return responseJSON({status: "success", message: "Created"});
    }

    // --- CASE 3: UPDATE (Existing Logic) ---
    if (rowIndex === -1) return responseJSON({status: "error", message: "Customer not found."});

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    function getColIndex(searchName) {
      var cleanSearch = searchName.toLowerCase().replace(/[^a-z0-9]/g, ''); 
      for (var i = 0; i < headers.length; i++) {
        var cleanHeader = String(headers[i]).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanHeader.indexOf(cleanSearch) > -1) return i + 1;
      }
      return -1;
    }

    var map = {
      'notes': ['notes', 'nextsteps'],
      'contact': ['customerpoint', 'contact'],
      'manager': ['managementlead', 'manager'],
      'strategic': ['strategic', 'owner'],
      'delivery': ['delivery', 'deliverylead'],
      'logo': ['logo', 'image'],
      'linkedin': ['linkedin', 'social'],
      'slides': ['slides', 'presentation'],
      'intro': ['introductory', 'intro'],
      'weekly': ['weekly'],
      'ppts': ['ppts', 'presentation'],
      'verbal': ['verbal'],
      'nda': ['nda'],
      'loi_issued': ['loiissued', 'loisent'],
      'loi_signed': ['loisigned', 'loirec'],
      'contract': ['contract', 'msa'],
      'parts': ['parts', 'spend']
    };

    for (var key in payload) {
      if (key === 'customer' || key === 'action') continue;
      var searchTerms = map[key] || [key];
      var colIndex = -1;
      for (var j = 0; j < searchTerms.length; j++) {
        colIndex = getColIndex(searchTerms[j]);
        if (colIndex > -1) break;
      }
      if (colIndex > -1) sheet.getRange(rowIndex, colIndex).setValue(payload[key]);
    }

    return responseJSON({status: "success", message: "Updated"});

  } catch (err) {
    return responseJSON({status: "error", message: err.toString()});
  } finally {
    lock.releaseLock();
  }
}

function getSheetById(ss, id) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === parseInt(id)) return sheets[i];
  }
  return null;
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
