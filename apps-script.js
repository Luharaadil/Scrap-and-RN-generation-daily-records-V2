/* 
  Upload this script to your Google Apps Script project.
  Sheets required:
  - "ProductionSummary"
  - "ScrapDetails"
  - "Targets" (or "Config")
*/

function doPost(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'saveSummary') {
      var sheet = ss.getSheetByName('ProductionSummary');
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({error: 'ProductionSummary sheet not found'})).setMimeType(ContentService.MimeType.JSON);
      
      // Assume mapping of data fields to columns, customize as necessary:
      sheet.appendRow([
        data.date,          // 1
        data.shift,         // 2
        data.bicUsage,      // 3
        data.plyUsage,      // 4
        data.mixingRubberUsage, // 5
        data.extrusionRubberUsage, // 6
        data.chaferUsage,   // 7
        data.timestamp      // 8
      ]);
      return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);

    } else if (action === 'saveScrap') {
      var sheet = ss.getSheetByName('ScrapDetails');
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({error: 'ScrapDetails sheet not found'})).setMimeType(ContentService.MimeType.JSON);
      
      var imageUrl = "";
      if (data.imageBase64) {
         // You can add logic to upload to Google Drive if needed, for now just pass URL if present
         imageUrl = data.imageBase64.substr(0, 50) + '...'; // truncate for demo, or save correctly
      }

      // Appending to ScrapDetails ONLY (removing ProductionSummary duplicate save as requested)
      sheet.appendRow([
        data.date,         // A: Date
        data.shift,        // B: Shift
        data.section,      // C: Section
        data.material,     // D: Material Type
        data.materialName, // E: Material Name
        data.weight,       // F: Weight
        data.mainReason,   // G: Main Reason
        data.reason,       // H: Reason Detail
        imageUrl,          // I: Picture
        data.timestamp     // J: Timestamp
      ]);
      
      return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);

    } else if (action === 'updateScrapReason') {
      var sheet = ss.getSheetByName('ScrapDetails');
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({error: 'ScrapDetails sheet not found'})).setMimeType(ContentService.MimeType.JSON);
      
      var dataRange = sheet.getDataRange();
      var values = dataRange.getValues();
      for (var i = 1; i < values.length; i++) {
        if (values[i][9] == data.timestamp) { // Assuming timestamp is in column J (index 9)
          sheet.getRange(i + 1, 8).setValue(data.reason); // Assuming Reason Detail is in column H (index 7)
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);

    } else if (action === 'saveTargets') {
      var sheet = ss.getSheetByName('Targets');
      if (!sheet) {
        sheet = ss.insertSheet('Targets');
        sheet.appendRow(['Category', 'Value', 'Period']);
      }
      sheet.clearContents();
      sheet.appendRow(['Category', 'Value', 'Period']); // Headers

      var targets = data.targets;
      for (var key in targets) {
        sheet.appendRow([key, targets[key].value, targets[key].period]);
      }
      return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({error: 'Unknown POST action'})).setMimeType(ContentService.MimeType.JSON);

  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify({error: e.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getData' || action === 'getRangeData') {
    var startDateStr = e.parameter.startDate || e.parameter.date;
    var endDateStr = e.parameter.endDate || e.parameter.date;
    
    // Simple filter by string comparison if dates are yyyy-mm-dd
    var summaries = [];
    var summarySheet = ss.getSheetByName('ProductionSummary');
    if (summarySheet) {
      var sData = summarySheet.getDataRange().getValues();
      for (var i = 1; i < sData.length; i++) { // Skip header
        var d = sData[i][0];
        if (d >= startDateStr && d <= endDateStr) {
          summaries.push({
            date: sData[i][0],
            shift: sData[i][1],
            bicUsage: sData[i][2],
            plyUsage: sData[i][3],
            mixingRubberUsage: sData[i][4],
            extrusionRubberUsage: sData[i][5],
            chaferUsage: sData[i][6],
            timestamp: sData[i][7]
          });
        }
      }
    }
    
    var scraps = [];
    var scrapSheet = ss.getSheetByName('ScrapDetails');
    if (scrapSheet) {
      var scData = scrapSheet.getDataRange().getValues();
      for (var i = 1; i < scData.length; i++) {
        var d = scData[i][0];
        if (d >= startDateStr && d <= endDateStr) {
          scraps.push({
            date: scData[i][0],
            shift: scData[i][1],
            section: scData[i][2],
            material: scData[i][3],
            materialName: scData[i][4],
            weight: scData[i][5],
            mainReason: scData[i][6],
            reason: scData[i][7],
            imageUrl: scData[i][8],
            timestamp: scData[i][9]
          });
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      summaries: summaries,
      scraps: scraps
    })).setMimeType(ContentService.MimeType.JSON);
    
  } else if (action === 'getTargets') {
    var targets = [];
    var sheet = ss.getSheetByName('Targets');
    if (sheet) {
      var tData = sheet.getDataRange().getValues();
      for (var i = 1; i < tData.length; i++) {
        targets.push({
          category: tData[i][0],
          value: tData[i][1],
          period: tData[i][2]
        });
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ targets: targets })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({error: 'Unknown GET action: ' + action})).setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
