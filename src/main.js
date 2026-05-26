// Thay link Web App của bạn vào đây
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwUqZEUH1lMgupZVXiaQj6MvIddfIMrmo44h1XhxCqctVPl_W-OGIOoirRn-tIUDUA/exec";
const ROOT_FOLDER_ID = "1xWDed1IBzGdCA4r5vbds1x6AF31hSIUT";

// Khôi phục trạng thái duyệt thư mục từ Local Storage (nếu có)
let savedStack = localStorage.getItem('appFolderStack');
let folderStack = savedStack ? JSON.parse(savedStack) : [{ id: ROOT_FOLDER_ID, name: "06. HÌNH ẢNH CONTENT" }];
let currentFolderId = folderStack[folderStack.length - 1].id;

// UI Elements
const itemList = document.getElementById('itemList');
const loading = document.getElementById('loading');
const currentFolderName = document.getElementById('currentFolderName');
const btnBack = document.getElementById('btnBack');
const fabMain = document.getElementById('fabMain');
const fabMenu = document.getElementById('fabMenu');
const fabIcon = document.getElementById('fabIcon');

// Modal Elements (Rename/Delete)
const customModal = document.getElementById('customModal');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalInput = document.getElementById('modalInput');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

// Media Viewer Elements
const mediaViewer = document.getElementById('mediaViewer');
const mediaTitle = document.getElementById('mediaTitle');
const mediaContent = document.getElementById('mediaContent');

// Toggle FAB Menu
fabMain.addEventListener('click', () => {
    fabMenu.classList.toggle('hidden');
    fabMenu.classList.toggle('flex');
    fabIcon.classList.toggle('fa-plus');
    fabIcon.classList.toggle('fa-times');
});

// Back Button Logic
btnBack.addEventListener('click', () => {
    if (folderStack.length > 1) {
        folderStack.pop();
        localStorage.setItem('appFolderStack', JSON.stringify(folderStack)); 
        let parent = folderStack[folderStack.length - 1];
        loadFolder(parent.id, parent.name);
    }
});

// Cập nhật Breadcrumbs (Thanh đường dẫn)
function updateBreadcrumbs() {
    if (folderStack.length === 1) {
        currentFolderName.textContent = folderStack[0].name;
    } else {
        const pathString = folderStack.map(f => f.name).join(' > ');
        currentFolderName.textContent = pathString;
        currentFolderName.title = pathString; 
    }
}

// Hàm gọi API chung
async function apiCall(action, payload = {}) {
    loading.classList.remove('hidden');
    payload.action = action;
    payload.folderId = currentFolderId;
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        loading.classList.add('hidden');
        return data;
    } catch (error) {
        loading.classList.add('hidden');
        uiAlert("Lỗi kết nối", "Có lỗi xảy ra hoặc do mạng yếu, vui lòng thử lại!");
        return { success: false };
    }
}

// Tải danh sách thư mục (Có Local Storage Caching)
async function loadFolder(folderId, folderName, isNewNavigation = false) {
    currentFolderId = folderId;
    
    if (isNewNavigation) {
        folderStack.push({ id: folderId, name: folderName });
        localStorage.setItem('appFolderStack', JSON.stringify(folderStack));
    }
    
    updateBreadcrumbs();
    btnBack.classList.toggle('hidden', folderStack.length <= 1);
    
    const cachedData = localStorage.getItem(`folder_${folderId}`);
    if (cachedData) {
        renderItems(JSON.parse(cachedData));
    } else {
        itemList.innerHTML = '<div class="col-span-2 text-center text-gray-400 mt-10"><i class="fas fa-spinner fa-spin text-2xl"></i><p class="mt-2">Đang tải dữ liệu...</p></div>';
    }

    const res = await apiCall('list');
    if (res && res.success) {
        localStorage.setItem(`folder_${folderId}`, JSON.stringify(res.data));
        renderItems(res.data);
    }
}

// Render UI 
function renderItems(items) {
    if (items.length === 0) {
        itemList.innerHTML = '<div class="col-span-2 text-center text-gray-400 mt-10">Thư mục trống</div>';
        return;
    }

    itemList.innerHTML = items.map(item => {
        if (item.type === 'folder') {
            return `
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 active:bg-blue-50 transition">
                <i class="fas fa-folder text-blue-500 text-5xl cursor-pointer" onclick="loadFolder('${item.id}', '${item.name}', true)"></i>
                <span class="text-sm font-semibold text-center line-clamp-2 w-full text-gray-700 mt-1 cursor-pointer" onclick="loadFolder('${item.id}', '${item.name}', true)">${item.name}</span>
                <div class="flex gap-4 text-gray-400 mt-2 border-t pt-2 w-full justify-center">
                    <i class="fas fa-edit p-1 active:text-blue-500 text-lg cursor-pointer" onclick="uiPrompt('Đổi tên', '${item.name}', (val) => renameItem('${item.id}', val, 'folder'))"></i>
                    <i class="fas fa-trash-alt p-1 active:text-red-500 text-lg cursor-pointer" onclick="uiConfirm('Xóa thư mục?', 'Bạn có chắc chắn muốn xóa thư mục này không?', () => deleteItem('${item.id}', 'folder'))"></i>
                </div>
            </div>`;
        } else {
            // Render file
            let isImage = item.mimeType.includes('image');
            let isVideo = item.mimeType.includes('video');
            
            let visualEl = isImage 
                ? `<img src="https://drive.google.com/thumbnail?id=${item.id}&sz=w400" class="w-full h-24 object-cover rounded-xl" loading="lazy" onerror="this.outerHTML='<i class=\\'fas fa-file-image text-green-500 text-5xl\\'></i>'">` 
                : `<i class="fas ${isVideo ? 'fa-file-video text-red-500' : 'fa-file text-gray-500'} text-5xl"></i>`;

            return `
            <div class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 relative group">
                <div class="w-full h-24 flex items-center justify-center bg-gray-50 rounded-xl overflow-hidden cursor-pointer" onclick="openMedia('${item.id}', '${item.mimeType}', '${item.name}')">
                    ${visualEl}
                </div>
                <span class="text-xs font-medium text-center line-clamp-2 w-full break-words text-gray-600 cursor-pointer" onclick="openMedia('${item.id}', '${item.mimeType}', '${item.name}')">${item.name}</span>
                
                <div class="flex gap-4 text-gray-400 mt-2 border-t pt-2 w-full justify-center">
                    <i class="fas fa-edit p-1 active:text-blue-500 text-lg cursor-pointer" onclick="uiPrompt('Đổi tên', '${item.name}', (val) => renameItem('${item.id}', val, 'file'))"></i>
                    <i class="fas fa-trash-alt p-1 active:text-red-500 text-lg cursor-pointer" onclick="uiConfirm('Xóa file?', 'File bị xóa sẽ vào thùng rác.', () => deleteItem('${item.id}', 'file'))"></i>
                </div>
            </div>`;
        }
    }).join('');
}

// Xử lý Upload NHIỀU FILE
async function handleMultipleFileUpload(event) {
    closeFab();
    const files = event.target.files;
    if (!files || files.length === 0) return;

    loading.classList.remove('hidden');

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        
        await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async function(e) {
                const base64Data = e.target.result.split(',')[1];
                const res = await apiCall('upload', {
                    filename: file.name,
                    mimeType: file.type,
                    data: base64Data
                });
                if (res && res.success) successCount++;
                resolve();
            };
            reader.readAsDataURL(file);
        });
    }

    loading.classList.add('hidden');
    if (successCount > 0) loadFolder(currentFolderId, folderStack[folderStack.length-1].name);
    
    event.target.value = '';
}

/* =========================================
   CÁC HÀM XỬ LÝ MEDIA VIEWER (XEM TỆP)
========================================= */

function openMedia(id, mimeType, name) {
    closeFab();
    mediaTitle.textContent = name;
    mediaViewer.classList.remove('hidden');
    mediaViewer.classList.add('flex');
    
    if (mimeType.includes('image')) {
        // Dùng API thumbnail nhưng set kích thước siêu lớn (w2000) để tải ảnh gốc/nét nhất
        mediaContent.innerHTML = `<img src="https://drive.google.com/thumbnail?id=${id}&sz=w2000" class="max-w-full max-h-full object-contain">`;
    } else if (mimeType.includes('video')) {
        // Nhúng trình xem video mặc định của Google Drive
        mediaContent.innerHTML = `<iframe src="https://drive.google.com/file/d/${id}/preview" class="w-full h-full border-0 rounded-lg"></iframe>`;
    } else {
        // File khác (PDF, Word...)
        mediaContent.innerHTML = `
            <div class="text-white text-center">
                <i class="fas fa-file-alt text-6xl mb-4 text-gray-500"></i>
                <p>Không hỗ trợ xem trước tệp này trực tiếp.</p>
                <a href="https://drive.google.com/file/d/${id}/view" target="_blank" class="mt-4 inline-block bg-blue-600 px-6 py-3 rounded-xl font-medium">Mở bằng Google Drive</a>
            </div>`;
    }
}

function closeMedia() {
    mediaViewer.classList.add('hidden');
    mediaViewer.classList.remove('flex');
    // Xóa nội dung HTML bên trong để video lập tức ngừng phát khi đóng
    mediaContent.innerHTML = '';
}


/* =========================================
   CÁC HÀM XỬ LÝ DỮ LIỆU & MODAL CUSTOM
========================================= */

function handleCreateFolder(name) {
    apiCall('createFolder', { name: name }).then(res => {
        if (res.success) loadFolder(currentFolderId, folderStack[folderStack.length-1].name);
    });
}

function renameItem(id, newName, type) {
    apiCall('rename', { id: id, newName: newName, type: type }).then(res => {
        if (res.success) loadFolder(currentFolderId, folderStack[folderStack.length-1].name);
    });
}

function deleteItem(id, type) {
    apiCall('delete', { id: id, type: type }).then(res => {
        if (res.success) loadFolder(currentFolderId, folderStack[folderStack.length-1].name);
    });
}

function closeFab() {
    fabMenu.classList.add('hidden');
    fabMenu.classList.remove('flex');
    fabIcon.classList.add('fa-plus');
    fabIcon.classList.remove('fa-times');
}

// --- CSS MODAL LOGIC ---
function showModalUI() {
    customModal.classList.remove('hidden');
    customModal.classList.add('flex');
    setTimeout(() => document.getElementById('modalBox').classList.remove('scale-95'), 10);
}

function closeModal() {
    document.getElementById('modalBox').classList.add('scale-95');
    setTimeout(() => {
        customModal.classList.add('hidden');
        customModal.classList.remove('flex');
    }, 150);
}

function uiPrompt(title, defaultText, callback) {
    closeFab();
    modalTitle.textContent = title;
    modalDesc.classList.add('hidden');
    modalInput.classList.remove('hidden');
    modalInput.value = (defaultText === 'Nhập tên thư mục...') ? '' : defaultText;
    modalInput.placeholder = defaultText;
    
    modalConfirmBtn.onclick = () => {
        const val = modalInput.value.trim();
        if (val) {
            callback(val);
            closeModal();
        }
    };
    showModalUI();
    setTimeout(() => modalInput.focus(), 100);
}

function uiConfirm(title, desc, callback) {
    closeFab();
    modalTitle.textContent = title;
    modalDesc.textContent = desc;
    modalDesc.classList.remove('hidden');
    modalInput.classList.add('hidden');
    
    modalConfirmBtn.onclick = () => {
        callback();
        closeModal();
    };
    showModalUI();
}

function uiAlert(title, desc) {
    uiConfirm(title, desc, () => {});
}

// Khởi chạy lần đầu
window.onload = () => loadFolder(currentFolderId, folderStack[folderStack.length-1].name);