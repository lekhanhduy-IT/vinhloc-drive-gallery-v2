const ROOT_FOLDER_ID = "1xWDed1IBzGdCA4r5vbds1x6AF31hSIUT"; 
const SHEET_ID = "1rzm6zSX24UB03QOKRhR3O4BvGiQvnaOz6mhA6YL3GqA";

function doPost(e) {
  const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const folderId = payload.folderId || ROOT_FOLDER_ID;
    
    let currentFolder;
    if (folderId && action !== 'getMeta' && action !== 'updateSingleMeta' && action !== 'globalSearch' && action !== 'getFileBase64' && action !== 'makePublic') {
      try { currentFolder = DriveApp.getFolderById(folderId); } catch(err){}
    }
    
    let result = { success: false, message: "Hành động không hợp lệ" };

    switch (action) {
      case 'list': result = getFolderContents(currentFolder); break;
      case 'createFolder':
        const newFolder = currentFolder.createFolder(payload.name);
        result = { success: true, id: newFolder.getId(), tempId: payload.tempId }; break;
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
        result = { success: true, message: "Đã lưu vào Sheets" }; break;
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
  let found = false; const targetId = String(id).trim();
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
  let items = []; const query = "title contains '" + keyword + "' and trashed = false";
  let folders = DriveApp.searchFolders(query);
  while(folders.hasNext() && items.filter(i => i.type === 'folder').length < 40) {
    let f = folders.next(); if (isDescendantOfRoot(f, rootId)) items.push({ id: f.getId(), name: f.getName(), type: 'folder' });
  }
  let files = DriveApp.searchFiles(query);
  while(files.hasNext() && items.filter(i => i.type === 'file').length < 50) {
    let f = files.next(); if (isDescendantOfRoot(f, rootId)) items.push({ id: f.getId(), name: f.getName(), type: 'file', mimeType: f.getMimeType(), url: f.getUrl() });
  }
  return items;
}
function isDescendantOfRoot(item, rootId) {
  if (item.getId() === rootId) return true; let current = item;
  while (true) { let parents = current.getParents(); if (!parents.hasNext()) return false; let parent = parents.next(); if (parent.getId() === rootId) return true; current = parent; }
}