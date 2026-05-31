const ROOT_FOLDER_ID = "1xWDed1IBzGdCA4r5vbds1x6AF31hSIUT"; 
const SHEET_ID = "1rzm6zSX24UB03QOKRhR3O4BvGiQvnaOz6mhA6YL3GqA";
const CACHE_FOLDER_ID = "1mneX5p8b4rIKNObOTxdn7yIDTlEscEZx"; // Thư mục lưu Não Nhện

// =========================================
// HÀM KIỂM TRA BẢO MẬT PHÂN QUYỀN GMAIL
// =========================================
// =========================================
// HÀM KIỂM TRA BẢO MẬT PHÂN QUYỀN GMAIL (ĐÃ SỬA LỖI SHARED DRIVE)
// =========================================
function checkAccess(folderId, userEmail) {
  if (!userEmail) return false;
  
  const emailHopLe = userEmail.toLowerCase().trim();

  // 1. TỰ ĐỘNG ĐẠI ĐỒNG: Luôn luôn cấp quyền cho chủ sở hữu App Script (Tài khoản của bạn)
  const adminEmail = Session.getEffectiveUser().getEmail().toLowerCase().trim();
  if (emailHopLe === adminEmail) return true;
  
  // 2. DANH SÁCH EMAIL NHÂN VIÊN ĐƯỢC PHÉP TRUY CẬP (Thêm các Gmail trong Shared Drive vào đây)
  const ALLOWED_EMAILS = [
    "admin@tudonghoavinhloc.com",
    "anhttcs181068@fpt.edu.vn",
    "khanhduyhazo@gmail.com",
    "lethimylinh190100@gmail.com",
    "mthuantruong2000@gmail.com",
    "nguyenphamnhaquyen88@gmail.com",
    "nguyenthanhlamct03@gmail.com",
    "nhaquyen456@gmail.com",
    "TRANLEDATTHINH@gmail.com",
    "tuanh.truong099@gmail.com",
    "tudonghoavinhlocct2015@gmail.com" // <-- Điền các Gmail cần cấp quyền vào đây
  ];
  
  // Kiểm tra email có nằm trong danh sách được chỉ định không
  for (let i = 0; i < ALLOWED_EMAILS.length; i++) {
    if (emailHopLe === ALLOWED_EMAILS[i].toLowerCase().trim()) return true;
  }
  
  // 3. DỰ PHÒNG: Quét quyền theo kiểu My Drive thông thường phòng hờ tương lai
  try {
    let folder = DriveApp.getFolderById(folderId);
    
    let owner = folder.getOwner() ? folder.getOwner().getEmail().toLowerCase().trim() : "";
    if (owner && owner === emailHợpLệ) return true;

    let editors = folder.getEditors();
    for (let i = 0; i < editors.length; i++) {
      if (editors[i].getEmail().toLowerCase().trim() === emailHợpLệ) return true;
    }

    let viewers = folder.getViewers();
    for (let i = 0; i < viewers.length; i++) {
      if (viewers[i].getEmail().toLowerCase().trim() === emailHợpLệ) return true;
    }
  } catch (e) {
    // Bỏ qua lỗi bảo mật nếu cấu trúc Drive không hỗ trợ lệnh quét trực tiếp
  }

  return false;
}

// =========================================
// HÀM XỬ LÝ REQUEST CHÍNH TỪ FRONTEND
// =========================================
function doPost(e) {
  const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const folderId = payload.folderId || ROOT_FOLDER_ID;
    
    // ======== BẠN BỊ THIẾU ĐOẠN CHẶN NÀY ========
    const userEmail = payload.email; // Lấy email từ frontend gửi lên
    
    // BƯỚC CHẶN BẢO MẬT: Kiểm tra xem email có nằm trong mảng ALLOWED_EMAILS không
    if (!checkAccess(ROOT_FOLDER_ID, userEmail)) {
      return ContentService.createTextOutput(JSON.stringify({ 
        success: false, 
        message: "Truy cập bị từ chối. Tài khoản Gmail này không có quyền trên thư mục Drive.",
        needLogin: true 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    // ============================================
    
    let currentFolder;
    if (folderId && action !== 'getMeta' && action !== 'updateSingleMeta' && action !== 'globalSearch' && action !== 'getFileBase64' && action !== 'makePublic') {
      try { currentFolder = DriveApp.getFolderById(folderId); } catch(err){}
    }    
    let result = { success: false, message: "Hành động không hợp lệ" };
    switch (action) {
      case 'saveGlobalCache':
        try {
          const cacheName = "_vinhloc_global_cache.json";
          let files = DriveApp.getFolderById(CACHE_FOLDER_ID).searchFiles("title = '" + cacheName + "' and trashed = false");
          let cacheFile;
          if (files.hasNext()) {
            cacheFile = files.next();
            cacheFile.setContent(payload.cacheData);
          } else {
            cacheFile = DriveApp.getFolderById(CACHE_FOLDER_ID).createFile(cacheName, payload.cacheData, "application/json");
          }
          result = { success: true, message: "Đã lưu Não Nhện" };
        } catch(err) { result = { success: false, message: err.toString() }; }
        break;

      case 'loadGlobalCache':
        try {
          const cacheName = "_vinhloc_global_cache.json";
          let files = DriveApp.getFolderById(CACHE_FOLDER_ID).searchFiles("title = '" + cacheName + "' and trashed = false");
          if (files.hasNext()) {
            let cacheFile = files.next();
            let content = cacheFile.getBlob().getDataAsString();
            result = { success: true, data: JSON.parse(content) };
          } else {
            result = { success: false, message: "Chưa có Não Nhện" };
          }
        } catch(err) { result = { success: false, message: err.toString() }; }
        break;

      case 'list': result = getFolderContents(currentFolder); break;

      case 'createFolder':
        const newFolder = currentFolder.createFolder(payload.name);
        const realId = newFolder.getId();
        // 1. Ghi Description trực tiếp vào Folder Details trên Drive
        if (payload.description) {
          newFolder.setDescription(payload.description);
        }
        
        // 2. Nếu đây là Mega-row, TỰ ĐỘNG lưu ID thật vào Google Sheets ngay lập tức
        if (payload.isMegaRow) {
          updateMetaInSheet(
            realId,               // Đảm bảo 100% lưu ID thật
            payload.name,         // Tên thư mục
            payload.category,     // Loại (Ý tưởng/Triển khai)
            '',                   // Mô tả (để trống lúc mới tạo)
            ''                    // Ảnh cover (để trống lúc mới tạo)
          );
        }
        
        // Trả kết quả ID thật về cho giao diện web
        result = { success: true, id: realId, tempId: payload.tempId };
        break;

      case 'rename':
        if (payload.type === 'folder') DriveApp.getFolderById(payload.id).setName(payload.newName);
        else DriveApp.getFileById(payload.id).setName(payload.newName);
        result = { success: true }; break;

      case 'delete':
        if (payload.type === 'folder') DriveApp.getFolderById(payload.id).setTrashed(true);
        else DriveApp.getFileById(payload.id).setTrashed(true);
        result = { success: true }; break;

      case 'upload':
        const blobUpload = Utilities.newBlob(Utilities.base64Decode(payload.data), payload.mimeType, payload.filename);
        const newFile = currentFolder.createFile(blobUpload);
        result = { success: true, id: newFile.getId(), url: newFile.getUrl() }; break;

      // CẤP THẺ BÀI CHO TRÌNH DUYỆT (Chunking Upload)
      case 'getToken':
        result = { success: true, token: ScriptApp.getOAuthToken() };
        break;

      case 'makePublic':
        try {
          if (payload.type === 'folder') DriveApp.getFolderById(payload.id).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          else DriveApp.getFileById(payload.id).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          result = { success: true, message: "Đã tạo link công khai" };
        } catch(err) { result = { success: false, message: err.toString() }; } break;

      case 'getFileBase64':
        try {
          const file = DriveApp.getFileById(payload.fileId);
          const base64Data = Utilities.base64Encode(file.getBlob().getBytes());
          result = { success: true, data: base64Data, mimeType: file.getBlob().getContentType() };
        } catch(err) { result = { success: false, message: err.toString() }; } break;

      case 'globalSearch':
        result = { success: true, data: searchFilesAndFoldersGlobally(payload.keyword, ROOT_FOLDER_ID) }; break;

      case 'getMeta':
        result = { success: true, meta: getMetaFromSheet() }; break;

      case 'updateSingleMeta':
        updateMetaInSheet(payload.meta.id, payload.meta.name, payload.meta.type, payload.meta.desc, payload.meta.cover);
        try {
          // Bổ sung tính năng: Cập nhật lại Description trên Drive khi người dùng bấm Lưu sửa đổi
          let driveDesc = "";
          if (payload.meta.type) driveDesc += `[${payload.meta.type}]\n`;
          if (payload.meta.desc) driveDesc += payload.meta.desc;
          // Ghi đè mô tả mới vào Folder Details
          DriveApp.getFolderById(payload.meta.id).setDescription(driveDesc.trim());
        } catch(e) {
          // Bọc try-catch phòng trường hợp cập nhật thông tin của File
        }
        
        result = { success: true, message: "Đã lưu vào Sheets và Drive" };
        break;
        
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ----------------- SHEET FUNCTIONS (QUYỀN LỰC TỐI CAO) -----------------
function getMetaFromSheet() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
    const data = sheet.getDataRange().getValues();
    let meta = {};
    for(let i = 1; i < data.length; i++) {
      let row = data[i];
      if(row[0]) meta[row[0]] = { name: row[1] || '', type: row[2] || 'Triển khai', desc: row[3] || '', cover: row[4] || '' };
    }
    return meta;
  } catch(e) { return {}; }
}

function updateMetaInSheet(id, name, type, desc, cover) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const data = sheet.getDataRange().getValues();
  let found = false;
  const targetId = String(id).trim();
  for(let i = 1; i < data.length; i++) {
    if(String(data[i][0]).trim() === targetId) { 
      sheet.getRange(i + 1, 2, 1, 4).setValues([[name, type, desc, cover]]);
      found = true; break;
    }
  }
  if(!found) sheet.appendRow([targetId, name, type, desc, cover]);
}

// ----------------- DRIVE FUNCTIONS -----------------
function getFolderContents(folder) {
  let items = [];
  const folders = folder.getFolders();
  while (folders.hasNext()) {
    let f = folders.next();
    // KHÔNG lấy Description từ Drive nữa để tránh rác dữ liệu
    items.push({ id: f.getId(), name: f.getName(), type: 'folder' });
  }
  const files = folder.getFiles();
  while (files.hasNext()) {
    let f = files.next();
    items.push({ id: f.getId(), name: f.getName(), type: 'file', mimeType: f.getMimeType(), url: f.getUrl() });
  }
  items.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'folder' ? -1 : 1;
  });
  return { success: true, data: items };
}

function searchFilesAndFoldersGlobally(keyword, rootId) {
  let items = [];
  const query = "title contains '" + keyword + "' and trashed = false";
  let folders = DriveApp.searchFolders(query);
  while(folders.hasNext() && items.filter(i => i.type === 'folder').length < 40) {
    let f = folders.next();
    if (isDescendantOfRoot(f, rootId)) items.push({ id: f.getId(), name: f.getName(), type: 'folder' });
  }
  let files = DriveApp.searchFiles(query);
  while(files.hasNext() && items.filter(i => i.type === 'file').length < 50) {
    let f = files.next();
    if (isDescendantOfRoot(f, rootId)) items.push({ id: f.getId(), name: f.getName(), type: 'file', mimeType: f.getMimeType(), url: f.getUrl() });
  }
  return items;
}

function isDescendantOfRoot(item, rootId) {
  if (item.getId() === rootId) return true; let current = item;
  while (true) { let parents = current.getParents(); if (!parents.hasNext()) return false; let parent = parents.next();
  if (parent.getId() === rootId) return true; current = parent; }
}

function FORCE_AUTH() {
  DriveApp.getRootFolder();
  Logger.log(ScriptApp.getOAuthToken());
}