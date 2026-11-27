/*******************************************************
 * داعم المواهب للقرآن الكريم - Google Apps Script
 * Keep the existing spreadsheet and original columns A:J.
 * New tracking fields are appended in K:M.
 *******************************************************/

const DAA_FOLDER_NAME = "تلاوات داعم المواهب";
const DAA_DEFAULT_STATUS = "تم استلام الطلب";

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0];
    daaEnsureTrackingColumns_(sheet);
    const p = (e && e.parameter) || {};

    const name = String(p.Name || "").trim();
    const phone = String(p.Phone || "").trim();
    const surah = String(p.Surah || "").trim();
    if (!name || !phone || !surah) throw new Error("بيانات التسجيل الأساسية غير مكتملة.");

    const requestId = String(p.RequestId || daaGenerateRequestId_()).trim();
    if (daaFindRequestRow_(sheet, requestId)) {
      return daaJson_({success:true, requestId, message:"الطلب مسجل بالفعل"});
    }

    const folder = daaGetOrCreateFolder_(DAA_FOLDER_NAME);
    let photoUrl = "";
    let audioUrl = "";

    if (p.photoData) {
      const photoBlob = Utilities.newBlob(
        Utilities.base64Decode(p.photoData), "image/jpeg",
        "صورة_" + name + "_" + requestId + ".jpg"
      );
      photoUrl = folder.createFile(photoBlob).getUrl();
    }
    if (p.audioData) {
      const audioBlob = Utilities.newBlob(
        Utilities.base64Decode(p.audioData), "audio/mpeg",
        "تلاوة_" + name + "_" + requestId + ".mp3"
      );
      audioUrl = folder.createFile(audioBlob).getUrl();
    }

    // Existing A:J layout remains unchanged; tracking data is appended in K:M.
    sheet.appendRow([
      new Date(), name, "'" + phone, surah,
      p.AyahFrom || "", p.AyahTo || "",
      p.PageFrom || "", p.PageTo || "",
      photoUrl, audioUrl,
      requestId, DAA_DEFAULT_STATUS, ""
    ]);

    return daaJson_({success:true, requestId, status:DAA_DEFAULT_STATUS});
  } catch (error) {
    return daaJson_({success:false, message:String(error && error.message || error)});
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const p = (e && e.parameter) || {};

  if (p.track) {
    const result = daaTrackRequest_(sheet, String(p.track).trim());
    if (p.callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(p.callback)) {
      return ContentService.createTextOutput(p.callback + "(" + JSON.stringify(result) + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return daaJson_(result);
  }

  const rows = sheet.getDataRange().getValues();
  const totalRegistrations = Math.max(0, rows.length - 1);
  const excludedNames = ["عبدالرحمن احمد", "عبدو مكي", "احمد محمد مكي"];
  const validReaders = [];

  for (let i = 1; i < rows.length; i++) {
    const name = String(rows[i][1] || "").trim();
    const excluded = excludedNames.some(exc => name.includes(exc));
    if (!excluded && name) {
      validReaders.push({
        name,
        surah: rows[i][3],
        ayahFrom: rows[i][4],
        ayahTo: rows[i][5]
      });
    }
  }

  return daaJson_({
    totalCount: totalRegistrations,
    latestReaders: validReaders.slice(-3).reverse()
  });
}

function daaTrackRequest_(sheet, requestId) {
  const rowNumber = daaFindRequestRow_(sheet, requestId);
  if (!rowNumber) return {success:true, found:false};

  const row = sheet.getRange(rowNumber, 1, 1, 13).getValues()[0];
  return {
    success:true,
    found:true,
    requestId:String(row[10] || ""),
    name:String(row[1] || ""),
    surah:String(row[3] || ""),
    status:String(row[11] || DAA_DEFAULT_STATUS),
    notes:String(row[12] || ""),
    date:row[0] instanceof Date
      ? Utilities.formatDate(row[0], Session.getScriptTimeZone(), "yyyy/MM/dd")
      : String(row[0] || "")
  };
}

function daaFindRequestRow_(sheet, requestId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const ids = sheet.getRange(2, 11, lastRow - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === requestId) return i + 2;
  }
  return 0;
}

function daaGenerateRequestId_() {
  const year = new Date().getFullYear();
  return "DAA-" + year + "-" + Utilities.getUuid().replace(/-/g, "").slice(0, 10).toUpperCase();
}

function daaEnsureTrackingColumns_(sheet) {
  const headers = ["رقم الطلب", "حالة الطلب", "ملاحظات الإدارة"];
  const current = sheet.getRange(1, 11, 1, 3).getDisplayValues()[0];
  if (current.every(v => !v)) {
    sheet.getRange(1, 11, 1, 3).setValues([headers]);
  } else {
    headers.forEach((header, i) => {
      if (!current[i]) sheet.getRange(1, 11 + i).setValue(header);
    });
  }
}

function daaGetOrCreateFolder_(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function daaJson_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
