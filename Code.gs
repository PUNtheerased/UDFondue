/**
 * UDFondue - Google Apps Script Backend
 * รับข้อมูลจากหน้าเว็บ LIFF -> บันทึกรูปลง Google Drive -> บันทึกข้อมูลลง Google Sheets
 *
 * สำคัญ: หลังแก้โค้ดต้อง Deploy -> Manage deployments -> New version
 * การ Save อย่างเดียวไม่ทำให้ Web App URL ใช้โค้ดใหม่
 */

const API_VERSION = "v11-full-upgrade";
const SHEET_HEADERS_CACHE_KEY = "sheet_headers_v11";
const SHEET_REPAIR_CACHE_KEY = "sheet_repair_v8";
const LOG_COLUMNS = 9;
const SPREADSHEET_ID = "19pIiTGsPMHbyTxULJDtiPbavmkCS07FBH2E5iHcd1KE";
const SHEET_NAME = "UDFondue_Database";
const LOG_SHEET_NAME = "UDFondue_Log";
const FOLDER_ID = "1zP6mUhrI7q-Qf-bgA5c4HJwIYU6LnpyJ";
const LINE_ACCESS_TOKEN = "1zQJQDz1un38gxqKc4Y91joSXB6oItmlQY9yG8EduB65R73XcMkHDkJ5pwBEkykFwWWgaRn4nv2sZer6yQglHR6UuJ/LE7Mqe1LsvhmUfKK/ABHu50jIpz6t8FxDuXcwNUo9q+RmWoXoqKUB9yZSIgdB04t89/1O/w1cDnyilFU=";
const LIFF_TRACK_URL = "https://liff.line.me/2010319415-VtukiTkR";
const LIFF_REPORT_URL = "https://liff.line.me/2010319415-epnUUdNV";
const PUBLIC_TRACK_BASE = "https://ud-fondue.vercel.app/track";
const ADMIN_PASSWORD = "UDFondue123WoWoWo";
const ADMIN_TOKEN_TTL_SEC = 28800;
const DEFAULT_STATUS = "รับเรื่องแล้ว";
const TZ = "GMT+7";

const STATUS_OPTIONS = [
  "รับเรื่องแล้ว",
  "กำลังดำเนินการ",
  "รอข้อมูลเพิ่ม",
  "เสร็จสิ้น",
  "ปิดเรื่อง",
  "REJECTED_MODERATION"
];

const COL = {
  DATE: 1,
  TIME: 2,
  LINE_ID: 3,
  NAME: 4,
  ROOM: 5,
  STUDENT_NO: 6,
  CATEGORY: 7,
  DETAIL: 8,
  IMAGE_COUNT: 9,
  IMAGE_URL: 10,
  SUBMIT_ID: 11,
  DEBUG: 12,
  STATUS: 13,
  ADMIN_NOTE: 14,
  STATUS_UPDATED: 15,
  IS_ANONYMOUS: 16,
  CONTACT_OPTIONAL: 17,
  BUILDING: 18,
  ZONE: 19,
  LOCATION_NOTE: 20,
  GPS_LAT: 21,
  GPS_LNG: 22,
  LF_TYPE: 23,
  LF_WHEN: 24,
  LF_RETURN_POINT: 25,
  LF_SECRET_DETAIL: 26,
  IS_PUBLIC_SHOWCASE: 27,
  TRACK_TOKEN: 28,
  UPVOTE_COUNT: 29,
  UPVOTED_LINE_IDS: 30,
  MERGED_TO_ID: 31,
  ASSIGNED_GROUP: 32,
  AFTER_IMAGE_COUNT: 33,
  AFTER_IMAGE_URL: 34,
  STATUS_HISTORY: 35,
  IMAGE_STORAGE: 36
};

const SHEET_HEADERS = [
  "วันที่",
  "เวลา",
  "LINE User ID",
  "ชื่อผู้แจ้ง",
  "ห้อง",
  "เลขที่",
  "ประเภทเรื่อง",
  "รายละเอียด",
  "จำนวนรูป",
  "ลิงก์รูปภาพ",
  "Submit ID",
  "Debug",
  "สถานะ",
  "หมายเหตุเจ้าหน้าที่",
  "อัปเดตสถานะล่าสุด",
  "ไม่ระบุตัวตน",
  "ช่องทางติดต่อ",
  "อาคาร",
  "โซน",
  "จุดอ้างอิง",
  "GPS Lat",
  "GPS Lng",
  "ประเภทของหาย",
  "เวลาที่หาย/พบ",
  "จุดรับคืน",
  "ข้อมูลลับของหาย",
  "แสดงสาธารณะ",
  "Track Token",
  "จำนวนโหวต",
  "รายชื่อโหวต",
  "รวมเข้าเคส",
  "ฝ่ายรับผิดชอบ",
  "จำนวนรูป After",
  "ลิงก์รูป After",
  "ประวัติสถานะ",
  "ที่เก็บรูป"
];

function doPost(e) {
  const timestamp = new Date();
  const payloadSize = getPayloadSize_(e);

  try {
    const data = parsePayload_(e);
    const action = data.action || "legacy";

    if (action === "submit") {
      return handleSubmit_(data, timestamp, payloadSize);
    }
    if (action === "uploadImage") {
      return handleUploadImage_(data, timestamp, payloadSize);
    }
    if (action === "notifySubmit") {
      return handleNotifySubmit_(data);
    }
    if (action === "trackList") {
      return handleTrackList_(data);
    }
    if (action === "trackDetail") {
      return handleTrackDetail_(data);
    }
    if (action === "trackPublicDetail") {
      return handleTrackPublicDetail_(data);
    }
    if (action === "trackLookup") {
      return handleTrackLookup_(data);
    }
    if (action === "getZoneActiveIssues") {
      return handleGetZoneActiveIssues_(data);
    }
    if (action === "upvoteTicket") {
      return handleUpvoteTicket_(data);
    }
    if (action === "getPublicLostFound") {
      return handleGetPublicLostFound_(data);
    }
    if (action === "adminAuth") {
      return handleAdminAuth_(data);
    }
    if (action === "adminBootstrap") {
      return handleAdminBootstrap_(data);
    }
    if (action === "adminList") {
      return handleAdminList_(data);
    }
    if (action === "adminUpdate") {
      return handleAdminUpdate_(data, timestamp);
    }
    if (action === "adminMergeTickets") {
      return handleAdminMergeTickets_(data, timestamp);
    }
    if (action === "adminModerationHide") {
      return handleAdminModerationHide_(data, timestamp);
    }
    if (action === "notifyLine") {
      return handleNotifyLine_(data);
    }

    return handleLegacy_(data, timestamp, payloadSize);

  } catch (error) {
    writeLog_(timestamp, payloadSize, "error", 0, 0, 0, error.toString(), "error", "");
    return jsonResponse_({ status: "error", message: error.toString() });
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  return jsonResponse_({
    status: "ok",
    version: API_VERSION,
    message: "UDFondue API is running"
  });
}

// ---------- Action handlers ----------

function handleSubmit_(data, timestamp, payloadSize) {
  const lineId = data.lineId || "ไม่ระบุ ID";
  if (!checkLineRateLimit_(lineId, "submit", 5, 600)) {
    writeLog_(timestamp, payloadSize, "submit", 0, 0, 0, "rate_limit", "rejected", data.submitId || "");
    return jsonResponse_({ status: "error", message: "ส่งบ่อยเกินไป กรุณารอสักครู่", code: "RATE_LIMIT" });
  }

  const isAnonymous = !!data.isAnonymous;
  const name = isAnonymous ? "ไม่ประสงค์ออกนาม" : (data.name || "ไม่ระบุชื่อ");
  const room = isAnonymous ? "" : (data.room || "");
  const studentNo = isAnonymous ? "" : (data.studentNo || "");
  let category = data.category || "ไม่ได้เลือก";
  const detail = data.detail || "";
  const submitId = data.submitId || ("UDF-" + Utilities.getUuid().replace(/-/g, "").substring(0, 8).toUpperCase());

  if (category === "other" || category === "อื่นๆ") {
    category = "อื่นๆ: " + (data.otherCategory || "ไม่ระบุหัวข้อ");
  }

  const textBlob = [category, detail, data.otherCategory || "", data.lfSecretDetail || ""].join(" ");
  if (containsProfanity_(textBlob)) {
    writeLog_(timestamp, payloadSize, "submit", 0, 0, 0, "profanity", "rejected", submitId);
    return jsonResponse_({ status: "error", message: "พบข้อความไม่เหมาะสม กรุณาแก้ไขก่อนส่ง", code: "PROFANITY" });
  }

  const imageUrls = normalizeImageUrls_(data);
  const imageCount = imageUrls.length || Number(data.imageCount) || 0;
  const imageUrl = imageUrls.join("\n");
  const trackToken = Utilities.getUuid().replace(/-/g, "");
  const assignedGroup = resolveAssignedGroup_(category);
  const statusUpdated = formatDateTimeTh_(timestamp);
  const statusHistory = JSON.stringify([{ status: DEFAULT_STATUS, at: statusUpdated, by: "system" }]);
  const isLf = category.indexOf("ตามหาของหาย") === 0 || category.indexOf("พบของ") === 0 || !!data.lfType;
  const isPublicShowcase = data.isPublicShowcase === true || data.isPublicShowcase === "true" || (isLf && data.isPublicShowcase !== false && data.isPublicShowcase !== "false");

  const sheet = getSheet_();
  ensureSheetHeaders_(sheet, true);
  const newRow = appendReportRow_(sheet, {
    timestamp: timestamp,
    lineId: lineId,
    name: name,
    room: room,
    studentNo: studentNo,
    category: category,
    detail: detail,
    imageCount: imageCount,
    imageUrl: imageUrl,
    submitId: submitId,
    debug: "",
    status: DEFAULT_STATUS,
    adminNote: "",
    statusUpdated: statusUpdated,
    isAnonymous: isAnonymous ? "TRUE" : "FALSE",
    contactOptional: data.contactOptional || "",
    building: data.building || "",
    zone: data.zone || "",
    locationNote: data.locationNote || "",
    gpsLat: data.gpsLat || "",
    gpsLng: data.gpsLng || "",
    lfType: data.lfType || "",
    lfWhen: data.lfWhen || "",
    lfReturnPoint: data.lfReturnPoint || "",
    lfSecretDetail: data.lfSecretDetail || "",
    isPublicShowcase: isPublicShowcase ? "TRUE" : "FALSE",
    trackToken: trackToken,
    upvoteCount: 0,
    upvotedLineIds: "",
    mergedToId: "",
    assignedGroup: assignedGroup,
    afterImageCount: 0,
    afterImageUrl: "",
    statusHistory: statusHistory,
    imageStorage: data.imageStorage || (imageUrls.length ? "supabase" : "")
  });
  fixTextColumnsAfterAppend_(sheet, newRow, room, studentNo);

  try {
    writeLog_(timestamp, payloadSize, "submit", imageCount, imageCount, imageCount ? 1 : 0, "", "success", submitId);
  } catch (logErr) {
    Logger.log("writeLog submit: " + logErr.toString());
  }

  try {
    sendLineThankYou_(lineId, submitId, category, DEFAULT_STATUS, trackToken);
    notifyAssignedGroup_(assignedGroup, submitId, category, data.building || "", data.zone || "", detail);
  } catch (notifyErr) {
    Logger.log("submit notify: " + notifyErr.toString());
  }

  return jsonResponse_({
    status: "success",
    message: "บันทึกข้อมูลเรียบร้อยแล้ว",
    submitId: submitId,
    trackToken: trackToken,
    trackUrl: buildTrackUrl_(submitId, trackToken)
  });
}

/** LINE-only notifications from Next (Supabase is SoT). */
function handleNotifyLine_(data) {
  const kind = String(data.kind || "");
  const submitId = data.submitId || "";
  try {
    if (kind === "submit") {
      sendLineThankYou_(data.lineId, submitId, data.category || "", data.status || DEFAULT_STATUS, data.trackToken || "");
      notifyAssignedGroup_(
        data.assignedGroup || resolveAssignedGroup_(data.category || ""),
        submitId,
        data.category || "",
        data.building || "",
        data.zone || "",
        data.detail || ""
      );
      return jsonResponse_({ status: "success" });
    }
    if (kind === "status") {
      sendLineStatusUpdate_(
        data.lineId,
        submitId,
        data.status || "",
        data.studentNote || data.adminNote || "",
        data.trackToken || ""
      );
      return jsonResponse_({ status: "success" });
    }
    if (kind === "janitor") {
      notifyAssignedGroup_(
        "FACILITY",
        submitId,
        data.category || "ปัญหาที่พบ",
        data.building || "",
        data.zone || "",
        "[ส่งต่อภารโรง] " + String(data.detail || "").substring(0, 120)
      );
      return jsonResponse_({ status: "success" });
    }
    if (kind === "lf_claim") {
      sendLinePushText_(
        data.lineId,
        [
          "มีคนสนใจของที่คุณแจ้งพบ",
          "• เลขที่: " + submitId,
          data.message || "เปิดหน้าติดตามเพื่อสร้างรหัสตอนนัดรับของ",
          "",
          "ดูรายละเอียด:",
          buildTrackUrl_(submitId, "")
        ].join("\n"),
        submitId
      );
      return jsonResponse_({ status: "success" });
    }
    if (data.lineId && data.message) {
      sendLinePushText_(data.lineId, String(data.message), submitId);
      return jsonResponse_({ status: "success" });
    }
    return jsonResponse_({ status: "error", message: "unknown notify kind" });
  } catch (err) {
    return jsonResponse_({ status: "error", message: err.toString() });
  }
}

function handleNotifySubmit_(data) {
  const submitId = data.submitId || "";
  const lineId = data.lineId || "";
  if (!submitId || !lineId) {
    return jsonResponse_({ status: "error", message: "ข้อมูลไม่ครบ" });
  }

  const sheet = getSheet_();
  const row = findRowBySubmitId_(sheet, submitId);
  if (row < 0) {
    return jsonResponse_({ status: "error", message: "ไม่พบเลขที่แจ้ง" });
  }

  const report = rowToReportObject_(getSingleRowRange_(sheet, row, 1, SHEET_HEADERS.length).getValues()[0], row);
  if (String(report.lineId) !== String(lineId)) {
    return jsonResponse_({ status: "error", message: "ไม่มีสิทธิ์" });
  }

  sendLineThankYou_(lineId, submitId, report.category, report.status, report.trackToken);
  return jsonResponse_({ status: "success", message: "ส่งการแจ้งเตือน LINE แล้ว" });
}

function handleUploadImage_(data, timestamp, payloadSize) {
  const submitId = data.submitId || "";
  const imageIndex = data.imageIndex || 1;
  const image = data.image || "";

  let url = "";
  let errorMsg = "";

  try {
    url = uploadImage_(image, timestamp, imageIndex);
    if (!url) {
      errorMsg = "ข้อมูลรูปไม่ถูกต้อง";
    }
  } catch (err) {
    errorMsg = err.toString();
  }

  if (url) {
    const sheet = getSheet_();
    const row = findRowBySubmitId_(sheet, submitId);
    if (row > 0) {
      const rowData = getSingleRowRange_(sheet, row, 1, SHEET_HEADERS.length).getValues()[0];
      const current = rowData[COL.IMAGE_URL - 1];
      let newVal = url;
      if (current && current !== "กำลังอัปโหลด...") {
        newVal = current + "\n" + url;
      }
      sheet.getRange(row, COL.IMAGE_URL).setValue(newVal);
    } else {
      errorMsg = "ไม่พบแถว submitId: " + submitId;
      url = "";
    }
  }

  writeLog_(timestamp, payloadSize, "uploadImage", 1, url ? 1 : 0, url ? 1 : 0, errorMsg, url ? "success" : "error", submitId);

  if (errorMsg) {
    writeDebugLog_(submitId, "uploadImage: " + errorMsg);
  }

  return jsonResponse_({
    status: url ? "success" : "error",
    message: url ? "อัปโหลดรูปสำเร็จ" : errorMsg
  });
}

function handleLegacy_(data, timestamp, payloadSize) {
  if (data.action === "submit") {
    return handleSubmit_(data, timestamp, payloadSize);
  }
  if (data.action === "uploadImage") {
    return handleUploadImage_(data, timestamp, payloadSize);
  }

  const name = data.name || "ไม่ระบุชื่อ";
  const lineId = data.lineId || "ไม่ระบุ ID";
  const room = data.room || "ไม่ระบุห้อง";
  const studentNo = data.studentNo || "ไม่ระบุเลขที่";
  let category = data.category || "ไม่ได้เลือก";
  const detail = data.detail || "";

  let images = [];
  if (Array.isArray(data.images)) {
    images = data.images;
  } else if (data.image) {
    images = [data.image];
  }

  if (category === "other" || category === "อื่นๆ") {
    category = "อื่นๆ: " + (data.otherCategory || "ไม่ระบุหัวข้อ");
  }

  const uploadErrors = [];
  const urls = [];

  for (let i = 0; i < images.length; i++) {
    try {
      const url = uploadImage_(images[i], timestamp, i + 1);
      if (url) {
        urls.push(url);
      } else {
        uploadErrors.push("รูป" + (i + 1) + ": ข้อมูลรูปไม่ถูกต้อง");
      }
    } catch (imgErr) {
      uploadErrors.push("รูป" + (i + 1) + ": " + imgErr.toString());
    }
  }

  let imageUrl = "";
  if (urls.length > 0) {
    imageUrl = urls.join("\n");
  } else if (uploadErrors.length > 0) {
    imageUrl = "อัปโหลดรูปไม่สำเร็จ: " + uploadErrors.join(" | ");
  }

  const sheet = getSheet_();
  ensureSheetHeaders_(sheet, true);
  const newRow = appendReportRow_(sheet, {
    timestamp: timestamp,
    lineId: lineId,
    name: name,
    room: room,
    studentNo: studentNo,
    category: category,
    detail: detail,
    imageCount: images.length,
    imageUrl: imageUrl,
    submitId: "",
    debug: uploadErrors.join(" | "),
    status: DEFAULT_STATUS,
    adminNote: "",
    statusUpdated: formatDateTimeTh_(timestamp)
  });
  fixTextColumnsAfterAppend_(sheet, newRow, room, studentNo);

  writeLog_(timestamp, payloadSize, "legacy", images.length, urls.length, urls.length, uploadErrors.join(" | "), "success", "");

  sendLineThankYou_(lineId, "", category);

  return jsonResponse_({ status: "success", message: "บันทึกข้อมูลเรียบร้อยแล้ว" });
}

// ---------- Tracking (นักเรียน) ----------

function handleTrackList_(data) {
  const lineId = data.lineId || "";
  if (!lineId) {
    return jsonResponse_({ status: "error", message: "ไม่พบ LINE User ID" });
  }

  const sheet = getSheet_();
  const rows = getAllReportRows_(sheet);
  const reports = [];

  for (let i = 0; i < rows.length; i++) {
    const report = rowToReportObject_(rows[i], i + 2);
    if (String(report.lineId) === String(lineId)) {
      const safe = toTrackReport_(report);
      safe.trackToken = report.trackToken;
      safe.trackUrl = buildTrackUrl_(report.submitId, report.trackToken);
      reports.push(safe);
    }
  }

  reports.sort(compareReportsNewestFirst_);

  return jsonResponse_({ status: "success", reports: reports });
}

function handleTrackDetail_(data) {
  const lineId = data.lineId || "";
  const submitId = data.submitId || "";
  if (!lineId || !submitId) {
    return jsonResponse_({ status: "error", message: "ข้อมูลไม่ครบ" });
  }

  const sheet = getSheet_();
  const row = findRowBySubmitId_(sheet, submitId);
  if (row < 0) {
    return jsonResponse_({ status: "error", message: "ไม่พบเลขที่แจ้งนี้" });
  }

  const report = rowToReportObject_(getSingleRowRange_(sheet, row, 1, SHEET_HEADERS.length).getValues()[0], row);
  if (String(report.lineId) !== String(lineId)) {
    return jsonResponse_({ status: "error", message: "ไม่มีสิทธิ์ดูเรื่องนี้" });
  }

  const safe = toTrackReport_(report);
  safe.trackToken = report.trackToken;
  safe.trackUrl = buildTrackUrl_(report.submitId, report.trackToken);
  return jsonResponse_({ status: "success", report: safe });
}

// ---------- Admin ----------

function handleAdminAuth_(data) {
  const auth = authenticateAdminPassword_(data.password || "");
  if (!auth.ok) {
    return jsonResponse_({ status: "error", message: auth.message });
  }
  return jsonResponse_({ status: "success", adminToken: auth.token });
}

function handleAdminBootstrap_(data) {
  let adminToken = data.adminToken || "";

  if (data.password) {
    const auth = authenticateAdminPassword_(data.password);
    if (!auth.ok) {
      return jsonResponse_({ status: "error", message: auth.message });
    }
    adminToken = auth.token;
  } else if (!verifyAdminToken_(adminToken)) {
    return jsonResponse_({ status: "error", message: "กรุณาเข้าสู่ระบบใหม่" });
  }

  const reports = getAdminReports_(data.filterStatus || "", data.search || "");
  return jsonResponse_({
    status: "success",
    adminToken: adminToken,
    reports: reports,
    statusOptions: STATUS_OPTIONS
  });
}

function handleAdminList_(data) {
  if (!verifyAdminToken_(data.adminToken)) {
    return jsonResponse_({ status: "error", message: "กรุณาเข้าสู่ระบบใหม่" });
  }

  const reports = getAdminReports_(data.filterStatus || "", data.search || "");
  return jsonResponse_({
    status: "success",
    reports: reports,
    statusOptions: STATUS_OPTIONS
  });
}

function authenticateAdminPassword_(password) {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD === "YOUR_ADMIN_PASSWORD") {
    return { ok: false, message: "ยังไม่ได้ตั้งรหัส Admin ใน Code.gs" };
  }
  if (password !== ADMIN_PASSWORD) {
    return { ok: false, message: "รหัสผ่านไม่ถูกต้อง" };
  }
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put("admin_" + token, "1", ADMIN_TOKEN_TTL_SEC);
  return { ok: true, token: token };
}

function getAdminReports_(filterStatus, search) {
  const searchLower = String(search || "").toLowerCase().trim();
  const sheet = getSheet_();
  const rows = getAllReportRows_(sheet);
  const reports = [];

  for (let i = 0; i < rows.length; i++) {
    const report = rowToReportObject_(rows[i], i + 2);
    if (filterStatus && report.status !== filterStatus) continue;
    if (searchLower) {
      const haystack = [
        report.name,
        report.room,
        report.studentNo,
        report.category,
        report.submitId,
        report.detail,
        report.building,
        report.zone,
        report.lfSecretDetail,
        report.assignedGroup
      ].join(" ").toLowerCase();
      if (haystack.indexOf(searchLower) === -1) continue;
    }
    reports.push(report);
  }

  reports.sort(compareReportsNewestFirst_);

  return reports;
}

function handleAdminUpdate_(data, timestamp) {
  if (!verifyAdminToken_(data.adminToken)) {
    return jsonResponse_({ status: "error", message: "กรุณาเข้าสู่ระบบใหม่" });
  }

  const submitId = data.submitId || "";
  const status = data.status || "";
  const adminNote = data.adminNote || "";

  if (!submitId) {
    return jsonResponse_({ status: "error", message: "ไม่พบ Submit ID" });
  }
  if (STATUS_OPTIONS.indexOf(status) === -1) {
    return jsonResponse_({ status: "error", message: "สถานะไม่ถูกต้อง" });
  }

  const sheet = getSheet_();
  const row = findRowBySubmitId_(sheet, submitId);
  if (row < 0) {
    return jsonResponse_({ status: "error", message: "ไม่พบเรื่องนี้" });
  }

  const updatedAt = formatDateTimeTh_(timestamp);
  const prev = rowToReportObject_(getSingleRowRange_(sheet, row, 1, SHEET_HEADERS.length).getValues()[0], row);
  getSingleRowRange_(sheet, row, COL.STATUS, COL.STATUS_UPDATED).setValues([[status, adminNote, updatedAt]]);

  const afterUrls = Array.isArray(data.afterImageUrls)
    ? data.afterImageUrls.map(String).filter(function (u) { return u.indexOf("http") === 0; })
    : [];
  if (afterUrls.length) {
    sheet.getRange(row, COL.AFTER_IMAGE_COUNT).setValue(afterUrls.length);
    sheet.getRange(row, COL.AFTER_IMAGE_URL).setValue(afterUrls.join("\n"));
  }

  appendStatusHistory_(sheet, row, status, updatedAt, "admin");

  const report = rowToReportObject_(getSingleRowRange_(sheet, row, 1, SHEET_HEADERS.length).getValues()[0], row);
  if (prev.status !== status) {
    try {
      sendLineStatusUpdate_(report.lineId, report.submitId, status, adminNote, report.trackToken);
    } catch (err) {
      Logger.log("status notify: " + err.toString());
    }
  }

  writeLog_(timestamp, 0, "adminUpdate", 0, 0, 0, status, "success", submitId);
  return jsonResponse_({ status: "success", message: "อัปเดตสถานะเรียบร้อย", report: report });
}

function handleAdminMergeTickets_(data, timestamp) {
  if (!verifyAdminToken_(data.adminToken)) {
    return jsonResponse_({ status: "error", message: "กรุณาเข้าสู่ระบบใหม่" });
  }

  const intoId = data.mergeIntoId || data.submitId || "";
  const fromIds = Array.isArray(data.mergeFromIds) ? data.mergeFromIds.map(String) : [];
  if (!intoId || !fromIds.length) {
    return jsonResponse_({ status: "error", message: "ข้อมูลรวมเคสไม่ครบ" });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = getSheet_();
    const intoRow = findRowBySubmitId_(sheet, intoId);
    if (intoRow < 0) {
      return jsonResponse_({ status: "error", message: "ไม่พบเคสหลัก" });
    }

    let upvoteTotal = Number(sheet.getRange(intoRow, COL.UPVOTE_COUNT).getValue()) || 0;
    const voters = String(sheet.getRange(intoRow, COL.UPVOTED_LINE_IDS).getValue() || "")
      .split(",")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);

    for (let i = 0; i < fromIds.length; i++) {
      const fromId = fromIds[i];
      if (!fromId || fromId === intoId) continue;
      const fromRow = findRowBySubmitId_(sheet, fromId);
      if (fromRow < 0) continue;
      upvoteTotal += Number(sheet.getRange(fromRow, COL.UPVOTE_COUNT).getValue()) || 0;
      String(sheet.getRange(fromRow, COL.UPVOTED_LINE_IDS).getValue() || "")
        .split(",")
        .map(function (s) { return s.trim(); })
        .filter(Boolean)
        .forEach(function (v) {
          if (voters.indexOf(v) === -1) voters.push(v);
        });
      sheet.getRange(fromRow, COL.MERGED_TO_ID).setValue(intoId);
      sheet.getRange(fromRow, COL.STATUS).setValue("ปิดเรื่อง");
      sheet.getRange(fromRow, COL.STATUS_UPDATED).setValue(formatDateTimeTh_(timestamp));
      sheet.getRange(fromRow, COL.ADMIN_NOTE).setValue("รวมเข้า " + intoId);
    }

    sheet.getRange(intoRow, COL.UPVOTE_COUNT).setValue(upvoteTotal);
    sheet.getRange(intoRow, COL.UPVOTED_LINE_IDS).setValue(voters.join(","));
    writeLog_(timestamp, 0, "adminMerge", 0, 0, 0, fromIds.join(","), "success", intoId);
    const report = rowToReportObject_(getSingleRowRange_(sheet, intoRow, 1, SHEET_HEADERS.length).getValues()[0], intoRow);
    return jsonResponse_({ status: "success", message: "รวมเคสเรียบร้อย", report: report });
  } catch (err) {
    return jsonResponse_({ status: "error", message: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function handleAdminModerationHide_(data, timestamp) {
  if (!verifyAdminToken_(data.adminToken)) {
    return jsonResponse_({ status: "error", message: "กรุณาเข้าสู่ระบบใหม่" });
  }
  const submitId = data.submitId || "";
  if (!submitId) {
    return jsonResponse_({ status: "error", message: "ไม่พบ Submit ID" });
  }
  const sheet = getSheet_();
  const row = findRowBySubmitId_(sheet, submitId);
  if (row < 0) {
    return jsonResponse_({ status: "error", message: "ไม่พบเรื่องนี้" });
  }
  const updatedAt = formatDateTimeTh_(timestamp);
  sheet.getRange(row, COL.STATUS).setValue("REJECTED_MODERATION");
  sheet.getRange(row, COL.IS_PUBLIC_SHOWCASE).setValue("FALSE");
  sheet.getRange(row, COL.STATUS_UPDATED).setValue(updatedAt);
  if (data.adminNote) {
    sheet.getRange(row, COL.ADMIN_NOTE).setValue(data.adminNote);
  }
  appendStatusHistory_(sheet, row, "REJECTED_MODERATION", updatedAt, "moderation");
  writeLog_(timestamp, 0, "moderationHide", 0, 0, 0, "hidden", "success", submitId);
  return jsonResponse_({ status: "success", message: "ซ่อนรายการแล้ว" });
}

function handleGetZoneActiveIssues_(data) {
  const building = String(data.building || "").trim();
  const zone = String(data.zone || "").trim();
  if (!building || !zone) {
    return jsonResponse_({ status: "success", reports: [] });
  }

  const sheet = getSheet_();
  const rows = getAllReportRows_(sheet);
  const closed = { "เสร็จสิ้น": 1, "ปิดเรื่อง": 1, "REJECTED_MODERATION": 1 };
  const reports = [];

  for (let i = 0; i < rows.length; i++) {
    const report = rowToReportObject_(rows[i], i + 2);
    if (report.mergedToId) continue;
    if (closed[report.status]) continue;
    if (String(report.building) !== building || String(report.zone) !== zone) continue;
    if (String(report.category).indexOf("ตามหาของหาย") === 0) continue;
    reports.push(toPublicReport_(report));
  }

  reports.sort(function (a, b) {
    return (Number(b.upvoteCount) || 0) - (Number(a.upvoteCount) || 0);
  });

  return jsonResponse_({ status: "success", reports: reports.slice(0, 20) });
}

function handleUpvoteTicket_(data) {
  const submitId = data.submitId || "";
  const lineId = data.lineId || "";
  if (!submitId || !lineId) {
    return jsonResponse_({ status: "error", message: "ข้อมูลไม่ครบ" });
  }
  if (!checkLineRateLimit_(lineId, "upvote", 20, 600)) {
    return jsonResponse_({ status: "error", message: "กดบ่อยเกินไป", code: "RATE_LIMIT" });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = getSheet_();
    const row = findRowBySubmitId_(sheet, submitId);
    if (row < 0) {
      return jsonResponse_({ status: "error", message: "ไม่พบเรื่องนี้" });
    }

    const mergedTo = String(sheet.getRange(row, COL.MERGED_TO_ID).getValue() || "").trim();
    const targetRow = mergedTo ? findRowBySubmitId_(sheet, mergedTo) : row;
    if (targetRow < 0) {
      return jsonResponse_({ status: "error", message: "ไม่พบเคสหลัก" });
    }

    const votersRaw = String(sheet.getRange(targetRow, COL.UPVOTED_LINE_IDS).getValue() || "");
    const voters = votersRaw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    if (voters.indexOf(String(lineId)) !== -1) {
      const count = Number(sheet.getRange(targetRow, COL.UPVOTE_COUNT).getValue()) || voters.length;
      return jsonResponse_({ status: "success", message: "โหวตไปแล้ว", upvoteCount: count, already: true });
    }

    voters.push(String(lineId));
    sheet.getRange(targetRow, COL.UPVOTED_LINE_IDS).setValue(voters.join(","));
    sheet.getRange(targetRow, COL.UPVOTE_COUNT).setValue(voters.length);
    writeLog_(new Date(), 0, "upvote", 0, 0, 0, "", "success", submitId);
    return jsonResponse_({ status: "success", message: "อัปโหวตแล้ว", upvoteCount: voters.length });
  } catch (err) {
    return jsonResponse_({ status: "error", message: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function handleTrackPublicDetail_(data) {
  const submitId = data.submitId || "";
  const trackToken = data.trackToken || data.t || "";
  if (!submitId || !trackToken) {
    return jsonResponse_({ status: "error", message: "ข้อมูลไม่ครบ" });
  }

  const sheet = getSheet_();
  const row = findRowBySubmitId_(sheet, submitId);
  if (row < 0) {
    return jsonResponse_({ status: "error", message: "ไม่พบเลขที่แจ้งนี้" });
  }

  const report = rowToReportObject_(getSingleRowRange_(sheet, row, 1, SHEET_HEADERS.length).getValues()[0], row);
  if (String(report.trackToken) !== String(trackToken)) {
    return jsonResponse_({ status: "error", message: "ลิงก์ไม่ถูกต้อง" });
  }
  if (report.status === "REJECTED_MODERATION") {
    return jsonResponse_({ status: "error", message: "ไม่พบเลขที่แจ้งนี้" });
  }

  return jsonResponse_({ status: "success", report: toTrackReport_(report) });
}

/** ค้นหาด้วยเลขที่แจ้งอย่างเดียว (หน้า /track) — ไม่คืนข้อมูลลับ */
function handleTrackLookup_(data) {
  const submitId = String(data.submitId || "").trim();
  if (!submitId) {
    return jsonResponse_({ status: "error", message: "กรุณากรอกเลขที่แจ้ง" });
  }

  const sheet = getSheet_();
  const row = findRowBySubmitId_(sheet, submitId);
  if (row < 0) {
    return jsonResponse_({ status: "error", message: "ไม่พบเลขที่แจ้งนี้ กรุณาตรวจสอบอีกครั้ง" });
  }

  const report = rowToReportObject_(getSingleRowRange_(sheet, row, 1, SHEET_HEADERS.length).getValues()[0], row);
  if (report.status === "REJECTED_MODERATION") {
    return jsonResponse_({ status: "error", message: "ไม่พบเลขที่แจ้งนี้ กรุณาตรวจสอบอีกครั้ง" });
  }

  // ค้นหาด้วยรหัสเปล่า = สรุปสาธารณะเท่านั้น (กัน enumeration)
  const safe = toPublicTrackSummary_(report);
  return jsonResponse_({ status: "success", report: safe, access: "public_summary" });
}

function toPublicTrackSummary_(report) {
  let history = [];
  try {
    history = report.statusHistory ? JSON.parse(report.statusHistory) : [];
  } catch (e) {
    history = [];
  }
  if (!Array.isArray(history)) history = [];
  history = history.map(function (h) {
    return { status: h.status || "", at: h.at || "" };
  });
  return {
    submitId: report.submitId,
    status: report.status,
    category: report.category,
    building: report.building,
    zone: report.zone,
    date: report.date,
    time: report.time,
    statusUpdated: report.statusUpdated,
    statusHistory: history,
    upvoteCount: report.upvoteCount || 0,
    isPublicSummary: true
  };
}

function handleGetPublicLostFound_(data) {
  const lfType = String(data.lfType || "").trim();
  const building = String(data.building || "").trim();
  const sheet = getSheet_();
  const rows = getAllReportRows_(sheet);
  const reports = [];

  for (let i = 0; i < rows.length; i++) {
    const report = rowToReportObject_(rows[i], i + 2);
    if (report.mergedToId) continue;
    if (report.status === "REJECTED_MODERATION") continue;
    if (String(report.isPublicShowcase).toUpperCase() !== "TRUE" && report.isPublicShowcase !== true) continue;
    const cat = String(report.category || "");
    const isLf = !!report.lfType || cat.indexOf("ตามหาของหาย") === 0 || cat.indexOf("พบของ") === 0;
    if (!isLf) continue;
    if (lfType && String(report.lfType) !== lfType && cat.indexOf(lfType) === -1) continue;
    if (building && String(report.building) !== building) continue;
    reports.push(toPublicLostFound_(report));
  }

  reports.sort(compareReportsNewestFirst_);
  return jsonResponse_({ status: "success", reports: reports.slice(0, 100) });
}

function verifyAdminToken_(token) {
  if (!token) return false;
  return CacheService.getScriptCache().get("admin_" + token) === "1";
}

// ---------- LINE Messaging API ----------

function buildTrackUrl_(submitId, trackToken) {
  if (!submitId) return PUBLIC_TRACK_BASE + "/";
  if (trackToken) {
    return PUBLIC_TRACK_BASE + "/" + encodeURIComponent(submitId) + "?t=" + encodeURIComponent(trackToken);
  }
  return PUBLIC_TRACK_BASE + "/" + encodeURIComponent(submitId);
}

function buildSubmitConfirmationMessage_(submitId, category, status, trackToken) {
  const resolvedStatus = status || DEFAULT_STATUS;
  let statusLine = resolvedStatus;
  if (resolvedStatus === DEFAULT_STATUS) {
    statusLine = resolvedStatus + " (รอเจ้าหน้าที่ตรวจสอบ)";
  }

  return [
    "รับเรื่องเรียบร้อยแล้ว",
    "ระบบได้รับข้อมูลของท่านแล้ว เจ้าหน้าที่จะดำเนินการตามลำดับ",
    "",
    "สรุปการแจ้งเรื่อง",
    "• เลขที่ติดตาม: " + (submitId || "—"),
    "• ประเภท: " + (category || "ไม่ได้เลือก"),
    "• สถานะ: " + statusLine,
    "",
    "ติดตามสถานะ:",
    buildTrackUrl_(submitId, trackToken),
    "",
    "แจ้งเรื่องเพิ่มเติม:",
    LIFF_REPORT_URL
  ].join("\n");
}

function sendLinePushText_(to, text, submitId) {
  if (!to || to === "ไม่ระบุ ID" || String(to).indexOf("TEST") !== -1) return;
  if (!LINE_ACCESS_TOKEN || LINE_ACCESS_TOKEN === "YOUR_LINE_CHANNEL_ACCESS_TOKEN") {
    Logger.log("LINE_ACCESS_TOKEN not configured, skip push message");
    return;
  }

  const payload = {
    to: to,
    messages: [{ type: "text", text: text }]
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + LINE_ACCESS_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options);
    const code = response.getResponseCode();
    if (code !== 200) {
      const errText = response.getContentText();
      Logger.log("LINE Push failed (" + code + "): " + errText);
      writeDebugLog_(submitId, "LINE push: " + errText);
    }
  } catch (err) {
    const errText = err.toString();
    Logger.log("LINE Push error: " + errText);
    if (errText.indexOf("UrlFetchApp") >= 0 || errText.indexOf("external_request") >= 0) {
      writeDebugLog_(submitId, "LINE push: ยังไม่ได้ขอสิทธิ์ — รัน setupPermissions ใน Editor แล้ว Deploy New version");
    } else {
      writeDebugLog_(submitId, "LINE push: " + errText);
    }
  }
}

function sendLineThankYou_(userId, submitId, category, status, trackToken) {
  if (submitId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = "line_sent_" + submitId;
    if (cache.get(cacheKey) === "1") return;
    cache.put(cacheKey, "1", 60);
  }
  sendLinePushText_(userId, buildSubmitConfirmationMessage_(submitId, category, status, trackToken), submitId);
}

function sendLineStatusUpdate_(userId, submitId, status, adminNote, trackToken) {
  const lines = [
    "อัปเดตสถานะเรื่องของท่าน",
    "• เลขที่ติดตาม: " + (submitId || "—"),
    "• สถานะปัจจุบัน: " + (status || "—")
  ];
  if (adminNote) {
    lines.push("• ข้อความจากครู: " + adminNote);
  }
  lines.push("");
  lines.push("ดูรายละเอียดและรูปประกอบ:");
  lines.push(buildTrackUrl_(submitId, trackToken));
  sendLinePushText_(userId, lines.join("\n"), submitId);
}

function resolveAssignedGroup_(category) {
  const cat = String(category || "");
  if (cat.indexOf("ตามหาของหาย") === 0 || cat.indexOf("พบของ") === 0) return "LOST_FOUND";
  if (cat.indexOf("เสนอความคิดเห็น") === 0) return "COUNCIL";
  if (cat.indexOf("ปัญหา") === 0) return "FACILITY";
  return "GENERAL";
}

function getGroupIdForKey_(key) {
  const props = PropertiesService.getScriptProperties();
  const map = {
    LOST_FOUND: props.getProperty("GROUP_ID_LOST_FOUND") || props.getProperty("GROUP_ID_LF") || "",
    COUNCIL: props.getProperty("GROUP_ID_COUNCIL") || "",
    FACILITY: props.getProperty("GROUP_ID_FACILITY") || "",
    GENERAL: props.getProperty("GROUP_ID_GENERAL") || ""
  };
  return map[key] || props.getProperty("GROUP_ID_GENERAL") || "";
}

function notifyAssignedGroup_(assignedGroup, submitId, category, building, zone, detail) {
  const groupId = getGroupIdForKey_(assignedGroup);
  if (!groupId) return;
  const text = [
    "มีเรื่องใหม่เข้าคิว (" + (assignedGroup || "GENERAL") + ")",
    "• เลขที่: " + submitId,
    "• ประเภท: " + category,
    "• สถานที่: " + [building, zone].filter(Boolean).join(" / "),
    "• รายละเอียด: " + String(detail || "").substring(0, 120),
    "• หน้าเจ้าหน้าที่: " + (PUBLIC_TRACK_BASE.replace("/track", "/nimda"))
  ].join("\n");
  sendLinePushText_(groupId, text, submitId);
}

/** รันครั้งเดียวจาก Apps Script Editor เพื่อขอสิทธิ์ UrlFetchApp แล้ว Deploy New version */
function authorizeLinePush() {
  Logger.log("กำลังเรียก LINE API เพื่อขอสิทธิ์ UrlFetchApp...");
  const response = UrlFetchApp.fetch("https://api.line.me/v2/bot/info", {
    method: "get",
    headers: { Authorization: "Bearer " + LINE_ACCESS_TOKEN },
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  const body = response.getContentText();
  Logger.log("HTTP " + code + " | " + body.substring(0, 200));

  if (code === 401) {
    throw new Error("LINE token ไม่ถูกต้อง (HTTP 401) — ตรวจ LINE_ACCESS_TOKEN ใน Code.gs");
  }
  if (code !== 200) {
    throw new Error("LINE API ตอบ HTTP " + code);
  }
  return "LINE auth OK (HTTP " + code + ")";
}

/** รันจาก Editor ครั้งเดียวหลัง deploy — ขอสิทธิ์ UrlFetch + ตรวจ scope (เลือกจาก dropdown ได้) */
function setupPermissions() {
  Logger.log("=== setupPermissions เริ่ม ===");
  const steps = [];
  try {
    const authResult = authorizeLinePush();
    steps.push("1. " + authResult);
    Logger.log("1. " + authResult);
  } catch (err) {
    const msg = "ขอสิทธิ์ UrlFetch ไม่สำเร็จ: " + err.toString();
    steps.push("1. " + msg);
    Logger.log("1. " + msg);
    Logger.log("→ Project Settings → OAuth scopes ต้องมี script.external_request");
    Logger.log("→ ตรวจ appsscript.json แล้ว Save");
    throw err;
  }
  steps.push("2. Deploy → Manage deployments → Edit → Version: New version → Deploy");
  steps.push("3. รัน testLinePush เพื่อทดสอบส่งข้อความจริง");
  Logger.log("2. Deploy → Manage deployments → New version → Deploy (สำคัญมาก!)");
  Logger.log("3. รัน testLinePush เพื่อทดสอบ");
  Logger.log("=== setupPermissions เสร็จ ===");
  return steps.join("\n");
}

/**
 * ทดสอบส่ง LINE push จริง — ดูผลที่ Execution log
 * แก้ lineUserId เป็น LINE User ID ของคุณ (คอลัมน์ C ใน Sheet)
 */
function testLinePush() {
  const lineUserId = "U5e2c33d3f48be8b6aaa6f869c7f83855";
  Logger.log("ทดสอบส่ง LINE ไปที่: " + lineUserId);

  const payload = {
    to: lineUserId,
    messages: [{ type: "text", text: "✅ UDFondue testLinePush สำเร็จ (" + API_VERSION + ")" }]
  };

  const response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + LINE_ACCESS_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  Logger.log("Push HTTP " + code);
  Logger.log(body);

  if (code === 200) {
    Logger.log("สำเร็จ! ตรวจข้อความใน LINE แล้วไป Deploy New version ถ้ายังส่งฟอร์มไม่ได้");
    return "OK: ส่ง LINE สำเร็จ";
  }
  throw new Error("ส่ง LINE ไม่สำเร็จ HTTP " + code + ": " + body);
}

// ---------- Diagnostics (Run จาก editor) ----------

/** รันครั้งเดียวจาก Apps Script Editor เพื่อย้ายแถวที่คอลัมน์เลื่อนกลับตำแหน่งที่ถูก */
function repairSheetColumns() {
  CacheService.getScriptCache().remove(SHEET_REPAIR_CACHE_KEY);
  return repairShiftedSheetRows_();
}

function testWriteSheet() {
  const timestamp = new Date();
  const submitId = "TEST-" + timestamp.getTime();

  try {
    const sheet = getSheet_();
    ensureSheetHeaders_(sheet, true);
    appendReportRow_(sheet, {
      timestamp: timestamp,
      lineId: "TEST-LINE-ID",
      name: "ทดสอบจาก Editor",
      room: "5/6",
      studentNo: "15",
      category: "ทดสอบ",
      detail: "แถวทดสอบ " + API_VERSION,
      imageCount: 0,
      imageUrl: "",
      submitId: submitId,
      debug: "testWriteSheet",
      status: DEFAULT_STATUS,
      adminNote: "",
      statusUpdated: formatDateTimeTh_(timestamp)
    });
    writeLog_(timestamp, 0, "test", 0, 0, 0, "", "success", submitId);
    return "OK: เขียน Sheet (" + SHEET_NAME + ") + Log สำเร็จ (API " + API_VERSION + ")";
  } catch (err) {
    return "ERROR: " + err.toString();
  }
}

function pingDrive() {
  try {
    const timestamp = new Date();
    const rootFolder = getDriveFolder_();
    const dayFolder = getOrCreateDayFolder_(rootFolder, timestamp);
    const ext = "txt";
    const fileName = formatTimeFile_(timestamp, 1) + "." + ext;
    const blob = Utilities.newBlob("UDFondue ping test " + API_VERSION, "text/plain", fileName);
    const file = dayFolder.createFile(blob);
    return "OK: สร้างไฟล์ " + file.getName() + " ในโฟลเดอร์ " + dayFolder.getName() + " (API " + API_VERSION + ")";
  } catch (err) {
    return "ERROR: " + err.toString();
  }
}

// ---------- Helpers ----------

function formatDateTh_(date) {
  return Utilities.formatDate(date, TZ, "dd/MM/yyyy");
}

function formatTimeTh_(date) {
  return Utilities.formatDate(date, TZ, "HH:mm:ss");
}

function formatDateTimeTh_(date) {
  return Utilities.formatDate(date, TZ, "dd/MM/yyyy HH:mm:ss");
}

function formatSheetCell_(val, kind) {
  if (val instanceof Date) {
    if (kind === "date") return Utilities.formatDate(val, TZ, "dd/MM/yyyy");
    if (kind === "time") return Utilities.formatDate(val, TZ, "HH:mm:ss");
    if (kind === "room") return Utilities.formatDate(val, TZ, "d/M");
    return Utilities.formatDate(val, TZ, "dd/MM/yyyy HH:mm:ss");
  }
  return val === undefined || val === null ? "" : String(val);
}

function fixTextColumnsAfterAppend_(sheet, row, room, studentNo) {
  const textRange = getSingleRowRange_(sheet, row, COL.ROOM, COL.STUDENT_NO);
  textRange.setNumberFormat("@");
  textRange.setValues([[room, studentNo]]);
}

function getSingleRowRange_(sheet, row, startCol, endCol) {
  return sheet.getRange(row, startCol, 1, endCol - startCol + 1);
}

function getRectRange_(sheet, startRow, startCol, endRow, endCol) {
  return sheet.getRange(startRow, startCol, endRow - startRow + 1, endCol - startCol + 1);
}

function formatTimeFile_(date, index) {
  const base = Utilities.formatDate(date, TZ, "HH.mm.ss");
  if (index > 1) {
    return base + "_" + index;
  }
  return base;
}

function getOrCreateSubfolder_(parentFolder, name) {
  const folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(name);
}

function getOrCreateDayFolder_(rootFolder, timestamp) {
  const year = Utilities.formatDate(timestamp, TZ, "yyyy");
  const month = Utilities.formatDate(timestamp, TZ, "MM");
  const day = Utilities.formatDate(timestamp, TZ, "dd");

  const yearFolder = getOrCreateSubfolder_(rootFolder, year);
  const monthFolder = getOrCreateSubfolder_(yearFolder, month);
  return getOrCreateSubfolder_(monthFolder, day);
}

function getSpreadsheet_() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    throw new Error("เปิด Spreadsheet ไม่ได้ (ID: " + SPREADSHEET_ID + "): " + err.toString());
  }
}

function getDriveFolder_() {
  try {
    return DriveApp.getFolderById(FOLDER_ID);
  } catch (err) {
    throw new Error("เปิดโฟลเดอร์ Drive ไม่ได้ (ID: " + FOLDER_ID + "): " + err.toString());
  }
}

function parsePayload_(e) {
  if (!e) {
    throw new Error("doPost ต้องเรียกผ่าน Web App URL ไม่สามารถ Run จาก editor ได้");
  }
  if (e.postData && e.postData.contents) {
    const contents = e.postData.contents;
    try {
      return JSON.parse(contents);
    } catch (parseErr) {
      if (e.parameter && e.parameter.payload) {
        return JSON.parse(e.parameter.payload);
      }
      throw parseErr;
    }
  }
  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  throw new Error("ไม่มีข้อมูล");
}

function getPayloadSize_(e) {
  if (!e) return 0;
  if (e.postData && e.postData.contents) {
    return e.postData.contents.length;
  }
  if (e.parameter && e.parameter.payload) {
    return e.parameter.payload.length;
  }
  return 0;
}

function uploadImage_(base64Image, timestamp, index) {
  if (!base64Image || base64Image.indexOf(",") === -1) return "";

  const rootFolder = getDriveFolder_();
  const dayFolder = getOrCreateDayFolder_(rootFolder, timestamp);
  const splitData = base64Image.split(",");
  const contentType = splitData[0].match(/:(.*?);/)[1];
  const rawBase64 = splitData[1];

  const decodedImg = Utilities.base64Decode(rawBase64);
  let extension = contentType.split("/")[1];
  if (extension === "jpeg") {
    extension = "jpg";
  }

  const fileName = formatTimeFile_(timestamp, index) + "." + extension;
  const blob = Utilities.newBlob(decodedImg, contentType, fileName);
  const file = dayFolder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (shareErr) {
    // ข้ามได้
  }

  return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1200";
}

function ensureSheetHeaders_(sheet, forWrite) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(SHEET_HEADERS_CACHE_KEY) === "1";

  if (cached && !forWrite) {
    return;
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
    sheet.setFrozenRows(1);
    cache.put(SHEET_HEADERS_CACHE_KEY, "1", 21600);
    return;
  }

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  if (lastCol < SHEET_HEADERS.length) {
    for (let c = lastCol + 1; c <= SHEET_HEADERS.length; c++) {
      sheet.getRange(1, c).setValue(SHEET_HEADERS[c - 1]);
    }
  }

  if (!cached) {
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
    sheet.setFrozenRows(1);
    cache.put(SHEET_HEADERS_CACHE_KEY, "1", 21600);
  }

  if (forWrite) {
    if (!cached) {
      backfillEmptyStatus_(sheet);
    }
  }
}

function backfillEmptyStatus_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const statusRange = getRectRange_(sheet, 2, COL.STATUS, lastRow, COL.STATUS);
  const statuses = statusRange.getValues();
  let changed = false;

  for (let i = 0; i < statuses.length; i++) {
    if (!statuses[i][0]) {
      statuses[i][0] = DEFAULT_STATUS;
      changed = true;
    }
  }

  if (changed) {
    statusRange.setValues(statuses);
  }
}

function buildReportRow_(data) {
  const ts = data.timestamp || new Date();
  return [
    formatDateTh_(ts),
    formatTimeTh_(ts),
    data.lineId || "",
    data.name || "",
    data.room || "",
    data.studentNo || "",
    data.category || "",
    data.detail || "",
    data.imageCount || 0,
    data.imageUrl || "",
    data.submitId || "",
    data.debug || "",
    data.status || DEFAULT_STATUS,
    data.adminNote || "",
    data.statusUpdated || formatDateTimeTh_(ts),
    data.isAnonymous || "",
    data.contactOptional || "",
    data.building || "",
    data.zone || "",
    data.locationNote || "",
    data.gpsLat || "",
    data.gpsLng || "",
    data.lfType || "",
    data.lfWhen || "",
    data.lfReturnPoint || "",
    data.lfSecretDetail || "",
    data.isPublicShowcase || "",
    data.trackToken || "",
    data.upvoteCount || 0,
    data.upvotedLineIds || "",
    data.mergedToId || "",
    data.assignedGroup || "",
    data.afterImageCount || 0,
    data.afterImageUrl || "",
    data.statusHistory || "",
    data.imageStorage || ""
  ];
}

function appendReportRow_(sheet, data) {
  const rowValues = buildReportRow_(data);
  const nextRow = Math.max(sheet.getLastRow(), 1) + 1;
  sheet.getRange(nextRow, 1, 1, SHEET_HEADERS.length).setValues([rowValues]);
  return nextRow;
}

function appendLogRow_(sheet, rowValues) {
  const values = rowValues.slice(0, LOG_COLUMNS);
  while (values.length < LOG_COLUMNS) {
    values.push("");
  }
  const nextRow = Math.max(sheet.getLastRow(), 1) + 1;
  sheet.getRange(nextRow, 1, 1, LOG_COLUMNS).setValues([values]);
  return nextRow;
}

function isSubmitIdValue_(val) {
  const s = String(val || "").trim();
  if (!s) return false;
  return /^UDF-[A-Z0-9]+$/i.test(s) ||
    /^\d{10,}-U[a-f0-9]+$/i.test(s) ||
    /^TEST-\d+$/.test(s);
}

function isDriveUrl_(val) {
  const s = String(val || "");
  return s.indexOf("drive.google.com") >= 0 || s.indexOf("docs.google.com") >= 0;
}

function isStatusValue_(val) {
  const s = String(val || "").trim();
  return STATUS_OPTIONS.indexOf(s) >= 0 || s === "ปิดเรื่อง";
}

function isDebugLikeValue_(val) {
  const s = String(val || "").trim();
  if (!s) return false;
  return s.indexOf("LINE push") >= 0 ||
    s.indexOf("uploadImage") >= 0 ||
    s.indexOf("testWriteSheet") >= 0 ||
    s.indexOf("log:") >= 0;
}

function isDateTimeValue_(val) {
  if (val instanceof Date) return true;
  const s = String(val || "").trim();
  return /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}$/.test(s);
}

function formatDateTimeFromCell_(val) {
  if (val instanceof Date) {
    return formatDateTimeTh_(val);
  }
  return String(val || "").trim();
}

function isShiftedReportRow_(row) {
  const imageUrl = String(row[COL.IMAGE_URL - 1] || "").trim();
  if (!isSubmitIdValue_(imageUrl) || isDriveUrl_(imageUrl)) {
    return false;
  }

  const submitCol = String(row[COL.SUBMIT_ID - 1] || "").trim();
  const statusCol = String(row[COL.STATUS - 1] || "").trim();
  return isStatusValue_(submitCol) || isDebugLikeValue_(submitCol) || (!statusCol && isDateTimeValue_(row[COL.DEBUG - 1]));
}

function normalizeShiftedReportRow_(row) {
  if (!isShiftedReportRow_(row)) {
    return null;
  }

  const out = row.slice(0, SHEET_HEADERS.length);
  while (out.length < SHEET_HEADERS.length) {
    out.push("");
  }

  const submitId = String(row[COL.IMAGE_URL - 1] || "").trim();
  const colK = String(row[COL.SUBMIT_ID - 1] || "").trim();
  const colL = String(row[COL.DEBUG - 1] || "").trim();
  const colM = String(row[COL.STATUS - 1] || "").trim();

  out[COL.IMAGE_URL - 1] = "";
  out[COL.SUBMIT_ID - 1] = submitId;

  if (isStatusValue_(colK)) {
    out[COL.DEBUG - 1] = isDebugLikeValue_(colL) ? colL : "";
    out[COL.STATUS - 1] = colK;
    out[COL.ADMIN_NOTE - 1] = isDateTimeValue_(row[COL.ADMIN_NOTE - 1]) ? "" : (row[COL.ADMIN_NOTE - 1] || "");
    if (isDateTimeValue_(colL)) {
      out[COL.STATUS_UPDATED - 1] = formatDateTimeFromCell_(colL);
    } else if (isDateTimeValue_(colM)) {
      out[COL.STATUS_UPDATED - 1] = formatDateTimeFromCell_(colM);
    }
  } else if (isDebugLikeValue_(colK)) {
    out[COL.DEBUG - 1] = colK;
    out[COL.STATUS - 1] = isStatusValue_(colL) ? colL : DEFAULT_STATUS;
    out[COL.ADMIN_NOTE - 1] = "";
    out[COL.STATUS_UPDATED - 1] = isDateTimeValue_(colM) ?
      formatDateTimeFromCell_(colM) :
      formatDateTimeFromCell_(colL);
  }

  return out;
}

function fixMisplacedStatusUpdated_(row) {
  const out = row.slice(0, SHEET_HEADERS.length);
  while (out.length < SHEET_HEADERS.length) {
    out.push("");
  }

  const statusUpdated = out[COL.STATUS_UPDATED - 1];
  const adminNote = out[COL.ADMIN_NOTE - 1];
  if (!statusUpdated && isDateTimeValue_(adminNote) && isSubmitIdValue_(out[COL.SUBMIT_ID - 1])) {
    out[COL.STATUS_UPDATED - 1] = formatDateTimeFromCell_(adminNote);
    out[COL.ADMIN_NOTE - 1] = "";
    return out;
  }
  return null;
}

function repairShiftedSheetRows_() {
  const sheet = getSheet_();
  ensureSheetHeaders_(sheet, false);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return "ไม่มีแถวข้อมูลที่ต้องแก้";
  }

  const rows = getRectRange_(sheet, 2, 1, lastRow, SHEET_HEADERS.length).getValues();
  let fixed = 0;
  const updates = [];

  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    const normalized = normalizeShiftedReportRow_(row);
    if (normalized) {
      row = normalized;
      fixed++;
    } else {
      const repaired = fixMisplacedStatusUpdated_(row);
      if (repaired) {
        row = repaired;
        fixed++;
      }
    }
    updates.push(row);
  }

  if (fixed > 0) {
    getRectRange_(sheet, 2, 1, lastRow, SHEET_HEADERS.length).setValues(updates);
  }

  return "แก้ไขคอลัมน์เลื่อน " + fixed + " แถว (API " + API_VERSION + ")";
}

function maybeRepairSheetOnce_() {
  const cache = CacheService.getScriptCache();
  if (cache.get(SHEET_REPAIR_CACHE_KEY) === "1") {
    return;
  }
  repairShiftedSheetRows_();
  cache.put(SHEET_REPAIR_CACHE_KEY, "1", 2592000);
}

function getAllReportRows_(sheet) {
  ensureSheetHeaders_(sheet, false);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return getRectRange_(sheet, 2, 1, lastRow, SHEET_HEADERS.length).getValues();
}

function rowToReportObject_(row, sheetRow) {
  const get = function (col) {
    const val = row[col - 1];
    return val === undefined || val === null ? "" : val;
  };

  const isAnonymousRaw = formatSheetCell_(get(COL.IS_ANONYMOUS), "text");
  const isAnonymous = String(isAnonymousRaw).toUpperCase() === "TRUE" || isAnonymousRaw === true;

  return {
    submitId: formatSheetCell_(get(COL.SUBMIT_ID), "text"),
    date: formatSheetCell_(get(COL.DATE), "date"),
    time: formatSheetCell_(get(COL.TIME), "time"),
    lineId: formatSheetCell_(get(COL.LINE_ID), "text"),
    name: isAnonymous ? "ไม่ประสงค์ออกนาม" : formatSheetCell_(get(COL.NAME), "text"),
    room: isAnonymous ? "" : formatSheetCell_(get(COL.ROOM), "room"),
    studentNo: isAnonymous ? "" : formatSheetCell_(get(COL.STUDENT_NO), "text"),
    category: formatSheetCell_(get(COL.CATEGORY), "text"),
    detail: formatSheetCell_(get(COL.DETAIL), "text"),
    imageCount: Number(get(COL.IMAGE_COUNT)) || 0,
    imageUrl: formatSheetCell_(get(COL.IMAGE_URL), "text"),
    status: formatSheetCell_(get(COL.STATUS) || DEFAULT_STATUS, "text"),
    adminNote: formatSheetCell_(get(COL.ADMIN_NOTE), "text"),
    statusUpdated: formatSheetCell_(get(COL.STATUS_UPDATED), "datetime"),
    isAnonymous: isAnonymous,
    contactOptional: formatSheetCell_(get(COL.CONTACT_OPTIONAL), "text"),
    building: formatSheetCell_(get(COL.BUILDING), "text"),
    zone: formatSheetCell_(get(COL.ZONE), "text"),
    locationNote: formatSheetCell_(get(COL.LOCATION_NOTE), "text"),
    gpsLat: formatSheetCell_(get(COL.GPS_LAT), "text"),
    gpsLng: formatSheetCell_(get(COL.GPS_LNG), "text"),
    lfType: formatSheetCell_(get(COL.LF_TYPE), "text"),
    lfWhen: formatSheetCell_(get(COL.LF_WHEN), "text"),
    lfReturnPoint: formatSheetCell_(get(COL.LF_RETURN_POINT), "text"),
    lfSecretDetail: formatSheetCell_(get(COL.LF_SECRET_DETAIL), "text"),
    isPublicShowcase: String(formatSheetCell_(get(COL.IS_PUBLIC_SHOWCASE), "text")).toUpperCase() === "TRUE",
    trackToken: formatSheetCell_(get(COL.TRACK_TOKEN), "text"),
    upvoteCount: Number(get(COL.UPVOTE_COUNT)) || 0,
    upvotedLineIds: formatSheetCell_(get(COL.UPVOTED_LINE_IDS), "text"),
    mergedToId: formatSheetCell_(get(COL.MERGED_TO_ID), "text"),
    assignedGroup: formatSheetCell_(get(COL.ASSIGNED_GROUP), "text"),
    afterImageCount: Number(get(COL.AFTER_IMAGE_COUNT)) || 0,
    afterImageUrl: formatSheetCell_(get(COL.AFTER_IMAGE_URL), "text"),
    statusHistory: formatSheetCell_(get(COL.STATUS_HISTORY), "text"),
    imageStorage: formatSheetCell_(get(COL.IMAGE_STORAGE), "text"),
    sheetRow: sheetRow || 0,
    sortTime: getRowSortTime_(row)
  };
}

function toPublicReport_(report) {
  return {
    submitId: report.submitId,
    category: report.category,
    detail: String(report.detail || "").substring(0, 160),
    status: report.status,
    building: report.building,
    zone: report.zone,
    upvoteCount: report.upvoteCount || 0,
    date: report.date,
    time: report.time
  };
}

function toPublicLostFound_(report) {
  return {
    submitId: report.submitId,
    category: report.category,
    detail: String(report.detail || "").substring(0, 200),
    status: report.status,
    building: report.building,
    zone: report.zone,
    lfType: report.lfType,
    lfWhen: report.lfWhen,
    lfReturnPoint: report.lfReturnPoint,
    imageUrl: report.imageUrl,
    date: report.date,
    time: report.time,
    name: report.isAnonymous ? "ไม่ประสงค์ออกนาม" : "ผู้แจ้ง",
    sortTime: report.sortTime,
    sheetRow: report.sheetRow
  };
}

function toTrackReport_(report) {
  let history = [];
  try {
    history = report.statusHistory ? JSON.parse(report.statusHistory) : [];
  } catch (e) {
    history = [];
  }
  const anonymous = !!report.isAnonymous;
  return {
    submitId: report.submitId,
    category: report.category,
    detail: report.detail,
    status: report.status,
    adminNote: report.adminNote,
    statusUpdated: report.statusUpdated,
    building: report.building,
    zone: report.zone,
    locationNote: report.locationNote,
    imageUrl: report.imageUrl,
    afterImageUrl: report.afterImageUrl,
    lfType: report.lfType,
    lfWhen: report.lfWhen,
    lfReturnPoint: report.lfReturnPoint,
    upvoteCount: report.upvoteCount || 0,
    date: report.date,
    time: report.time,
    name: anonymous ? "ไม่ประสงค์ออกนาม" : report.name,
    room: anonymous ? "" : report.room,
    // ไม่ส่ง: lineId, lfSecretDetail, contactOptional, studentNo, trackToken, gps*
    statusHistory: history,
    isAnonymous: anonymous
  };
}

function normalizeImageUrls_(data) {
  if (Array.isArray(data.imageUrls)) {
    return data.imageUrls.map(String).filter(function (u) {
      return u && (u.indexOf("http") === 0 || u.indexOf("blob:") === 0);
    });
  }
  if (data.imageUrl && String(data.imageUrl).indexOf("http") === 0) {
    return String(data.imageUrl).split("\n").filter(Boolean);
  }
  return [];
}

function checkLineRateLimit_(lineId, action, maxCount, windowSec) {
  if (!lineId || String(lineId).indexOf("TEST") !== -1) return true;
  const cache = CacheService.getScriptCache();
  const key = "rl_" + action + "_" + String(lineId);
  const raw = cache.get(key);
  const count = raw ? Number(raw) : 0;
  if (count >= maxCount) return false;
  cache.put(key, String(count + 1), windowSec || 600);
  return true;
}

function containsProfanity_(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return false;
  const banned = [
    "เหี้ย", "ควย", "เย็ด", "สัส", " fucking", "shit", "bitch", "ห่า", "หน้าหี", "ไอ้สัตว์"
  ];
  for (let i = 0; i < banned.length; i++) {
    if (banned[i] && t.indexOf(banned[i].trim()) !== -1) return true;
  }
  return false;
}

function appendStatusHistory_(sheet, row, status, at, by) {
  let history = [];
  try {
    const raw = sheet.getRange(row, COL.STATUS_HISTORY).getValue();
    if (raw) history = JSON.parse(String(raw));
  } catch (e) {
    history = [];
  }
  if (!Array.isArray(history)) history = [];
  history.push({ status: status, at: at, by: by || "admin" });
  if (history.length > 30) history = history.slice(history.length - 30);
  sheet.getRange(row, COL.STATUS_HISTORY).setValue(JSON.stringify(history));
}

function getRowSortTime_(row) {
  const dateVal = row[COL.DATE - 1];
  const timeVal = row[COL.TIME - 1];

  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    const d = new Date(dateVal.getTime());
    if (timeVal instanceof Date && !isNaN(timeVal.getTime())) {
      d.setHours(timeVal.getHours(), timeVal.getMinutes(), timeVal.getSeconds(), 0);
    } else if (typeof timeVal === "number") {
      if (timeVal > 0 && timeVal < 1) {
        const totalSec = Math.round(timeVal * 86400);
        d.setHours(0, 0, 0, 0);
        d.setSeconds(totalSec);
      } else if (timeVal >= 1) {
        return timeVal;
      }
    } else {
      const t = formatSheetCell_(timeVal, "time");
      const tm = String(t).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (tm) {
        d.setHours(parseInt(tm[1], 10), parseInt(tm[2], 10), tm[3] ? parseInt(tm[3], 10) : 0, 0);
      }
    }
    return d.getTime();
  }

  const fromStrings = parseThaiDateTimeParts_(
    formatSheetCell_(dateVal, "date"),
    formatSheetCell_(timeVal, "time")
  );
  if (fromStrings) return fromStrings;

  const su = formatSheetCell_(row[COL.STATUS_UPDATED - 1], "datetime");
  const suParts = String(su).trim().match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?)$/);
  if (suParts) {
    const parsed = parseThaiDateTimeParts_(suParts[1], suParts[2]);
    if (parsed) return parsed;
  }

  return 0;
}

function parseThaiDateTimeParts_(dateStr, timeStr) {
  const d = dateStr ? String(dateStr).trim() : "";
  const t = String(timeStr || "00:00:00").trim();
  if (!d) return null;
  const dm = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const tm = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!dm) return null;
  return new Date(
    parseInt(dm[3], 10),
    parseInt(dm[2], 10) - 1,
    parseInt(dm[1], 10),
    tm ? parseInt(tm[1], 10) : 0,
    tm ? parseInt(tm[2], 10) : 0,
    tm && tm[3] ? parseInt(tm[3], 10) : 0
  ).getTime();
}

function getReportSortTime_(report) {
  if (report && report.sortTime) return report.sortTime;

  const fromDateTime = parseThaiDateTimeParts_(report.date, report.time);
  if (fromDateTime) return fromDateTime;

  const su = String(report.statusUpdated || "").trim();
  const suParts = su.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?)$/);
  if (suParts) {
    const parsed = parseThaiDateTimeParts_(suParts[1], suParts[2]);
    if (parsed) return parsed;
  }

  const sid = String(report.submitId || "");
  const tsMatch = sid.match(/^(\d{10,13})(?:-|$)/);
  if (tsMatch) return parseInt(tsMatch[1], 10);

  return 0;
}

function compareReportsNewestFirst_(a, b) {
  const diff = getReportSortTime_(b) - getReportSortTime_(a);
  if (diff !== 0) return diff;
  return (b.sheetRow || 0) - (a.sheetRow || 0);
}

function findRowBySubmitId_(sheet, submitId) {
  if (!submitId) return -1;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const target = String(submitId);
  const searchCols = [COL.SUBMIT_ID, COL.IMAGE_URL];

  for (let c = 0; c < searchCols.length; c++) {
    const col = searchCols[c];
    const ids = getRectRange_(sheet, 2, col, lastRow, col).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === target) {
        return i + 2;
      }
    }
  }
  return -1;
}

function writeDebugLog_(submitId, message) {
  if (!submitId || !message) return;
  try {
    const sheet = getSheet_();
    ensureSheetHeaders_(sheet, true);
    const row = findRowBySubmitId_(sheet, submitId);
    if (row > 0) {
      const current = sheet.getRange(row, COL.DEBUG).getValue();
      const newVal = current ? current + " | " + message : message;
      sheet.getRange(row, COL.DEBUG).setValue(newVal);
    }
  } catch (err) {
    Logger.log("writeDebugLog_ error: " + err.toString());
  }
}

function getSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function ensureLogSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
    sheet.getRange(1, 1, 1, LOG_COLUMNS).setValues([[
      "วันที่/เวลา", "ขนาด Payload", "Action", "จำนวนรูปที่ได้รับ",
      "จำนวนรูปที่อัปสำเร็จ", "Upload OK", "ข้อผิดพลาด", "สถานะ", "Submit ID"
    ]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getLogSheet_() {
  return ensureLogSheet_();
}

function setupLogSheet() {
  ensureLogSheet_();
  return "สร้างแท็บ " + LOG_SHEET_NAME + " เรียบร้อยแล้ว (API " + API_VERSION + ")";
}

function writeLog_(timestamp, payloadSize, action, imageCount, uploadedCount, uploadOk, errors, status, submitId) {
  try {
    appendLogRow_(getLogSheet_(), [
      timestamp, payloadSize, action, imageCount, uploadedCount,
      uploadOk, errors || "", status, submitId || ""
    ]);
  } catch (logErr) {
    Logger.log("writeLog_ error: " + logErr.toString());
    writeDebugLog_(submitId, "log: " + logErr.toString());
  }
}

function jsonResponse_(obj) {
  const payload = Object.assign({ version: API_VERSION }, obj || {});
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
