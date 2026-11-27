/*******************************************************
 * داعم المواهب للقرآن الكريم - إدارة طلبات التلاوات
 * الأعمدة الأصلية A:J محفوظة كما هي.
 * K: رقم الطلب | L: الحالة | M: ملاحظات داخلية
 * N: آخر تحديث | O: مرات إعادة التقديم | P: حساب المتقدم | Q: سبب الرفض العام
 *******************************************************/
const DAA_FOLDER_NAME = "تلاوات داعم المواهب";
const DAA_DEFAULT_STATUS = "تم استلام الطلب";
const DAA_WORKFLOW = ["تم استلام الطلب","تم قبول الطلب","جاري تجهيز التلاوة","جاري المونتاج والهندسة الصوتية","تم تحديد موعد النشر","تم النشر"];
const DAA_SUPABASE_URL = "https://xkraqrjkimkdawlazjyl.supabase.co";
const DAA_SUPABASE_KEY = "sb_publishable_QXPRwlQsN2-5a-hy5ejKJA_2tmf7MJr";

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const p = (e && e.parameter) || {};
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    daaEnsureColumns_(sheet);

    if (p.action === "review") {
      const adminUser = daaRequireAdmin_(p.access_token);
      const rowNumber = daaFindRequestRow_(sheet, String(p.requestId || "").trim());
      if (!rowNumber) throw new Error("الطلب غير موجود.");
      const status = String(p.status || "").trim();
      if (!DAA_WORKFLOW.includes(status) && !["مرفوض","مطلوب تعديل","قيد المراجعة"].includes(status)) throw new Error("حالة غير صحيحة.");
      const note = String(p.note || "").trim().slice(0, 1200);
      const scheduledAt = String(p.scheduledAt || "").trim().slice(0, 40);
      const publishedUrl = String(p.publishedUrl || "").trim().slice(0, 1000);
      const publicNote = String(p.publicNote || "").trim().slice(0, 1200);
      if (status === "مرفوض" && !note) throw new Error("اكتب سبب الرفض حتى يعرف المتقدم المطلوب تعديله.");
      if (status === "تم تحديد موعد النشر" && !scheduledAt) throw new Error("حدد موعد النشر أولاً.");
      if (status === "تم النشر" && publishedUrl && !/^https?:\/\//i.test(publishedUrl)) throw new Error("رابط النشر غير صحيح.");
      const now = new Date();
      const previousStatus = String(sheet.getRange(rowNumber, 12).getValue() || DAA_DEFAULT_STATUS);
      let history = [];
      try { history = JSON.parse(String(sheet.getRange(rowNumber, 18).getValue() || "[]")); } catch (_) {}
      if (!Array.isArray(history)) history = [];
      if (!history.length) {
        const created = sheet.getRange(rowNumber, 1).getValue();
        history.push({status:previousStatus, at:created instanceof Date ? created.toISOString() : now.toISOString(), note:"تم استلام الطلب"});
      }
      const eventNote = status === "مرفوض" ? note : (publicNote || (status === "تم تحديد موعد النشر" ? "موعد النشر: " + scheduledAt : ""));
      history.push({status, at:now.toISOString(), note:eventNote, scheduledAt, publishedUrl});
      sheet.getRange(rowNumber, 12).setValue(status);
      sheet.getRange(rowNumber, 14).setValue(now);
      sheet.getRange(rowNumber, 17).setValue(status === "مرفوض" ? note : publicNote);
      sheet.getRange(rowNumber, 18, 1, 4).setValues([[JSON.stringify(history), scheduledAt, publishedUrl, publicNote]]);
      const applicantUserId = String(sheet.getRange(rowNumber, 16).getValue() || "").trim();
      const notificationSent = applicantUserId ? daaSendApplicantNotification_(p.access_token, applicantUserId, status, eventNote, String(p.requestId || ""), String(adminUser.id || "")) : false;
      return daaJson_({success:true, requestId:p.requestId, status, notificationSent, history});
    }

    if (p.action === "replace") {
      const requestId = String(p.RequestId || "").trim();
      const phone = daaDigits_(p.Phone || "");
      const rowNumber = daaFindRequestRow_(sheet, requestId);
      if (!rowNumber) throw new Error("رقم الطلب غير موجود.");
      const savedPhone = daaDigits_(sheet.getRange(rowNumber, 3).getDisplayValue());
      if (!phone || phone !== savedPhone) throw new Error("رقم الهاتف غير مطابق للطلب.");
      if (!p.photoData && !p.audioData) throw new Error("اختر صورة أو تسجيلًا جديدًا للاستبدال.");
      const folder = daaGetOrCreateFolder_(DAA_FOLDER_NAME);
      const name = String(sheet.getRange(rowNumber, 2).getValue() || "قارئ").trim();
      if (p.photoData) {
        const photo = daaSaveBase64_(folder, p.photoData, String(p.photoMime || "image/jpeg"), "صورة_" + name + "_" + requestId + ".jpg");
        sheet.getRange(rowNumber, 9).setValue(photo.getUrl());
      }
      if (p.audioData) {
        const audio = daaSaveBase64_(folder, p.audioData, String(p.audioMime || "audio/mpeg"), "تلاوة_" + name + "_" + requestId + ".mp3");
        sheet.getRange(rowNumber, 10).setValue(audio.getUrl());
      }
      const revision = Number(sheet.getRange(rowNumber, 15).getValue() || 0) + 1;
      sheet.getRange(rowNumber, 12, 1, 4).setValues([["إعادة التقديم - قيد المراجعة", sheet.getRange(rowNumber, 13).getValue(), new Date(), revision]]);
      sheet.getRange(rowNumber, 17).clearContent();
      return daaJson_({success:true, requestId, status:"إعادة التقديم - قيد المراجعة"});
    }

    const name = String(p.Name || "").trim();
    const phone = String(p.Phone || "").trim();
    const surah = String(p.Surah || "").trim();
    if (!name || !phone || !surah) throw new Error("بيانات التسجيل الأساسية غير مكتملة.");
    const requestId = String(p.RequestId || daaGenerateRequestId_()).trim();
    if (daaFindRequestRow_(sheet, requestId)) return daaJson_({success:true, requestId, message:"الطلب مسجل بالفعل"});
    const folder = daaGetOrCreateFolder_(DAA_FOLDER_NAME);
    let photoUrl = "", audioUrl = "";
    if (p.photoData) photoUrl = daaSaveBase64_(folder, p.photoData, "image/jpeg", "صورة_" + name + "_" + requestId + ".jpg").getUrl();
    if (p.audioData) audioUrl = daaSaveBase64_(folder, p.audioData, "audio/mpeg", "تلاوة_" + name + "_" + requestId + ".mp3").getUrl();
    sheet.appendRow([
      new Date(), name, "'" + phone, surah,
      p.AyahFrom || "", p.AyahTo || "", p.PageFrom || "", p.PageTo || "",
      photoUrl, audioUrl, requestId, DAA_DEFAULT_STATUS, "", new Date(), 0, String(p.UserId || "").trim(), ""
    ]);
    return daaJson_({success:true, requestId, status:DAA_DEFAULT_STATUS});
  } catch (error) {
    return daaJson_({success:false, message:String(error && error.message || error)});
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  daaEnsureColumns_(sheet);
  let result;

  if (p.track) {
    result = daaTrackRequest_(sheet, String(p.track).trim());
  } else if (p.admin === "requests") {
    try {
      daaRequireAdmin_(p.access_token);
      result = {success:true, requests:daaListRequests_(sheet)};
    } catch (error) {
      result = {success:false, error:String(error && error.message || error), requests:[]};
    }
  } else {
    const rows = sheet.getDataRange().getValues();
    const totalRegistrations = Math.max(0, rows.length - 1);
    const excludedNames = ["عبدالرحمن احمد", "عبدو مكي", "احمد محمد مكي"];
    const validReaders = [];
    for (let i = 1; i < rows.length; i++) {
      const name = String(rows[i][1] || "").trim();
      if (name && !excludedNames.some(exc => name.includes(exc))) {
        validReaders.push({name, surah:rows[i][3], ayahFrom:rows[i][4], ayahTo:rows[i][5]});
      }
    }
    result = {totalCount:totalRegistrations, latestReaders:validReaders.slice(-3).reverse()};
  }

  if (p.callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(p.callback)) {
    return ContentService.createTextOutput(p.callback + "(" + JSON.stringify(result) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return daaJson_(result);
}

function daaTrackRequest_(sheet, requestId) {
  const rowNumber = daaFindRequestRow_(sheet, requestId);
  if (!rowNumber) return {success:true, found:false};
  const row = sheet.getRange(rowNumber, 1, 1, 21).getValues()[0];
  const status = String(row[11] || DAA_DEFAULT_STATUS);
  const reason = ["مرفوض", "مطلوب تعديل"].includes(status) ? String(row[16] || "") : "";
  let history = [];
  try { history = JSON.parse(String(row[17] || "[]")); } catch (_) {}
  if (!Array.isArray(history) || !history.length) history = [{status:DAA_DEFAULT_STATUS, at:row[0] instanceof Date ? row[0].toISOString() : new Date().toISOString(), note:"تم استلام الطلب"}];
  return {
    success:true, found:true, requestId:String(row[10] || ""), name:String(row[1] || ""),
    surah:String(row[3] || ""), status, reason,
    photoUrl:daaPublicMediaUrl_(String(row[8] || ""), "image"),
    audioUrl:daaPublicMediaUrl_(String(row[9] || ""), "audio"),
    scheduledAt:String(row[18] || ""), publishedUrl:String(row[19] || ""),
    publicNote:String(row[20] || ""), history,
    canReplace:status === "مرفوض" || status === "مطلوب تعديل",
    date:row[0] instanceof Date ? Utilities.formatDate(row[0], Session.getScriptTimeZone(), "yyyy/MM/dd") : String(row[0] || ""),
    updatedAt:row[13] instanceof Date ? Utilities.formatDate(row[13], Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm") : ""
  };
}

function daaListRequests_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 21).getValues();
  return values.map((r, i) => ({
    row:i + 2, requestId:String(r[10] || ""), name:String(r[1] || ""),
    phone:String(r[2] || "").replace(/^'/, ""), surah:String(r[3] || ""),
    photoUrl:daaPublicMediaUrl_(String(r[8] || ""), "image"), audioUrl:daaPublicMediaUrl_(String(r[9] || ""), "audio"), userId:String(r[15] || ""),
    status:String(r[11] || DAA_DEFAULT_STATUS), note:String(r[16] || ""),
    scheduledAt:String(r[18] || ""), publishedUrl:String(r[19] || ""), publicNote:String(r[20] || ""),
    date:r[0] instanceof Date ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm") : String(r[0] || ""),
    revisions:Number(r[14] || 0)
  })).filter(r => r.requestId).reverse();
}

function daaRequireAdmin_(token) {
  if (!token) throw new Error("جلسة الإدارة غير موجودة. سجّل الدخول من جديد.");
  const headers = {apikey:DAA_SUPABASE_KEY, Authorization:"Bearer " + token};
  const userResponse = UrlFetchApp.fetch(DAA_SUPABASE_URL + "/auth/v1/user", {method:"get", headers, muteHttpExceptions:true});
  if (userResponse.getResponseCode() !== 200) throw new Error("انتهت جلسة الدخول أو أنها غير صالحة.");
  const roleResponse = UrlFetchApp.fetch(DAA_SUPABASE_URL + "/rest/v1/rpc/admin_check_access", {
    method:"post", contentType:"application/json", payload:"{}", headers, muteHttpExceptions:true
  });
  if (roleResponse.getResponseCode() !== 200) throw new Error("تعذر التحقق من صلاحية الإدارة.");
  const role = JSON.parse(roleResponse.getContentText() || "null");
  const allowed = Array.isArray(role) ? role[0] && role[0].allowed : role && role.allowed;
  if (!allowed) throw new Error("هذا الحساب غير مصرح له بإدارة طلبات التلاوات.");
  return JSON.parse(userResponse.getContentText() || "{}");
}

function daaSendApplicantNotification_(token, userId, status, note, requestId, adminUserId) {
  let body;
  const trackingUrl = "https://abdodaim14-ai.github.io/-/track.html?id=" + encodeURIComponent(requestId);
  if (status === "مرفوض") {
    body = "طلب التلاوة رقم " + requestId + " يحتاج إلى تعديل. السبب: " + (note || "يرجى مراجعة الملفات") + " افتح صفحة التتبع لاستبدال الصورة أو التسجيل: " + trackingUrl;
  } else if (status === "مقبول") {
    body = "تم قبول طلب التلاوة رقم " + requestId + "، شكرًا لمشاركتك. تابع صفحة التتبع: " + trackingUrl;
  } else {
    body = "تم تحديث حالة طلب التلاوة رقم " + requestId + " إلى: " + status + ". " + trackingUrl;
  }
  const headers = {apikey:DAA_SUPABASE_KEY,Authorization:"Bearer " + token};
  try {
    const response = UrlFetchApp.fetch(DAA_SUPABASE_URL + "/rest/v1/platform_notifications", {
      method:"post", contentType:"application/json",
      payload:JSON.stringify({user_id:userId,actor_id:adminUserId,kind:"quran_request_status",message:body,is_read:false}),
      headers:Object.assign({},headers,{Prefer:"return=minimal"}),
      muteHttpExceptions:true
    });
    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) return true;
  } catch (_) {}
  // Fallback: keep a record in the existing administration notification center.
  try {
    const fallback = UrlFetchApp.fetch(DAA_SUPABASE_URL + "/rest/v1/rpc/admin_send_notification", {
      method:"post", contentType:"application/json",
      payload:JSON.stringify({p_target_user_id:userId,p_title:"تحديث طلب التلاوة",p_body:body}),
      headers, muteHttpExceptions:true
    });
    return fallback.getResponseCode() >= 200 && fallback.getResponseCode() < 300;
  } catch (_) { return false; }
}

function daaFindRequestRow_(sheet, requestId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const ids = sheet.getRange(2, 11, lastRow - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === requestId) return i + 2;
  return 0;
}
function daaEnsureColumns_(sheet) {
  const headers = ["رقم الطلب", "حالة الطلب", "ملاحظات داخلية للإدارة", "آخر تحديث", "مرات إعادة التقديم", "معرف حساب المتقدم", "سبب الرفض الظاهر للمتقدم", "سجل مراحل الطلب", "موعد النشر", "رابط التلاوة المنشورة", "ملاحظة ظاهرة للمتقدم"];
  sheet.getRange(1, 11, 1, headers.length).setValues([headers]);
}
function daaGenerateRequestId_() {
  return "DAA-" + new Date().getFullYear() + "-" + Utilities.getUuid().replace(/-/g, "").slice(0, 12).toUpperCase();
}
function daaSaveBase64_(folder, data, mime, name) {
  const clean = String(data).replace(/^data:[^,]*,/, "");
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(clean), mime, name));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file;
}
function daaGetOrCreateFolder_(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}
function daaPublicMediaUrl_(url, kind) {
  const match = String(url || "").match(/[-\w]{25,}/);
  if (!match) return "";
  try { DriveApp.getFileById(match[0]).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
  return "https://drive.google.com/uc?export=" + (kind === "image" ? "view" : "download") + "&id=" + match[0];
}
function daaDigits_(value) { return String(value || "").replace(/[^0-9]/g, ""); }
function daaJson_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
