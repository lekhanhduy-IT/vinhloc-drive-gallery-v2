        const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwQ1jyePOExK9YbdU3LykeAoy_FqLmZNl7WKVRTV1G6BJ1zzAeE_tUReM-rswzupdU/exec";
        const ROOT_FOLDER_ID = "1xWDed1IBzGdCA4r5vbds1x6AF31hSIUT";

        let savedStack = localStorage.getItem('appFolderStack');
        let folderStack = savedStack ? JSON.parse(savedStack) : [{ id: ROOT_FOLDER_ID, name: "Triển khai" }];
        let currentFolderId = folderStack[folderStack.length - 1].id;
        
        let currentDriveItems = [];
        let subFolderCache = {}; 
        
        let appMeta = JSON.parse(localStorage.getItem('vinhloc_meta')) || {};
        let expandedMegas = JSON.parse(localStorage.getItem('expandedMegas')) || [];
        
        function showToast(msg, isError = false) {
            let t = document.createElement('div');
            t.className = `toast-popup ${isError ? 'bg-red-600' : 'bg-gray-900'}`; 
            t.innerHTML = msg;
            document.getElementById('toast-container').appendChild(t);
            requestAnimationFrame(() => t.classList.add('show'));
            setTimeout(() => {
                t.classList.remove('show');
                setTimeout(() => t.remove(), 400);
            }, 1500); 
        }

        window.addEventListener('popstate', (e) => {
            if (folderStack.length > 1) {
                folderStack.pop();
                localStorage.setItem('appFolderStack', JSON.stringify(folderStack));
                let parent = folderStack[folderStack.length - 1];
                loadFolder(parent.id, parent.name, false, true); 
            }
        });

        let syncQueueCount = 0;
        const syncIndicator = document.getElementById('sync-indicator');
        const syncIcon = document.getElementById('sync-icon');
        const syncText = document.getElementById('sync-text');

        function updateSyncIndicator() {
            if (syncQueueCount > 0) {
                syncIcon.innerHTML = '<i class="fas fa-circle-notch fa-spin text-blue-600"></i>';
                syncText.textContent = 'Đang lưu ngầm...';
                syncText.className = 'text-blue-600';
                syncIndicator.classList.remove('opacity-0');
            } else {
                syncIcon.innerHTML = '<i class="fa-solid fa-check-circle text-green-500"></i>';
                syncText.textContent = 'Đã đồng bộ';
                syncText.className = 'text-green-600';
                setTimeout(() => {
                    if (syncQueueCount === 0) syncIndicator.classList.add('opacity-0');
                }, 1500);
            }
        }

        async function bgApiCall(action, payload = {}) {
            syncQueueCount++;
            updateSyncIndicator();
            payload.action = action; 
            if (!payload.folderId) payload.folderId = currentFolderId;
            
            try {
                const response = await fetch(SCRIPT_URL, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload),
                    redirect: 'follow'
                });
                const data = await response.json();
                return data;
            } catch (err) {
                console.error("Lỗi kết nối mạng:", err);
                return { success: false };
            } finally {
                syncQueueCount--;
                updateSyncIndicator();
            }
        }

        function smoothUpdateUI(newMeta) {
            for (let id in newMeta) {
                const meta = newMeta[id];
                
                document.querySelectorAll(`.item-name-${id}`).forEach(el => {
                    if (meta.name && el.textContent !== meta.name) {
                        el.textContent = meta.name;
                        el.title = meta.name; 
                    }
                });

                document.querySelectorAll(`.item-desc-${id}`).forEach(el => {
                    const newDesc = meta.desc || 'Chưa có mô tả';
                    if (el.textContent !== newDesc) {
                        el.textContent = newDesc;
                        if(meta.desc) el.classList.remove('hidden');
                    }
                });

                document.querySelectorAll(`.item-cover-img-${id}`).forEach(img => {
                    const icon = document.querySelector(`.item-cover-icon-${id}`);
                    if (meta.cover) {
                        if(img.src !== meta.cover) img.src = meta.cover;
                        img.classList.remove('hidden');
                        if(icon) icon.classList.add('hidden');
                    } else {
                        img.classList.add('hidden');
                        if(icon) icon.classList.remove('hidden');
                    }
                });
            }
        }

        async function silentFetchMeta() {
            try {
                const res = await fetch(SCRIPT_URL, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'getMeta' })
                }).then(r => r.json());

                if(res && res.success && res.meta) {
                    const isChanged = JSON.stringify(appMeta) !== JSON.stringify(res.meta);
                    if (isChanged) {
                        appMeta = res.meta;
                        localStorage.setItem('vinhloc_meta', JSON.stringify(appMeta));
                        smoothUpdateUI(appMeta);
                    }
                }
            } catch (e) {}
        }

        setInterval(() => {
            if (document.getElementById('infoModal').classList.contains('hidden')) {
                silentFetchMeta();
            }
        }, 2500);

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                silentFetchMeta();
            }
        });

        function saveLocalMeta() { localStorage.setItem('vinhloc_meta', JSON.stringify(appMeta)); }
        function getMeta(id) { 
            if(!appMeta[id]) { appMeta[id] = { type: currentCategory, desc: '', cover: '' }; }
            return appMeta[id];
        }

        let currentCategory = 'Triển khai';

        const folderListEl = document.getElementById('folderList');
        const fileListEl = document.getElementById('fileList');
        const loading = document.getElementById('loading');
        const currentFolderName = document.getElementById('currentFolderName');
        const btnBack = document.getElementById('btnBack');
        const btnMenu = document.getElementById('btnMenu');
        const fabMain = document.getElementById('fabMain');
        const fabMenu = document.getElementById('fabMenu');
        const fabIcon = document.getElementById('fabIcon');
        const searchInput = document.getElementById('searchInput');
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        const btnOpenDesign = document.getElementById('btn-open-design');

        function toggleSidebar() {
            sidebar.classList.toggle('open');
            sidebarOverlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
        }

        function switchCategory(cat, navigate = true) {
            currentCategory = cat;
            document.getElementById('menu-trienkhai').classList.remove('active');
            document.getElementById('menu-ytuong').classList.remove('active');
            if(cat === 'Triển khai') document.getElementById('menu-trienkhai').classList.add('active');
            else document.getElementById('menu-ytuong').classList.add('active');
            
            toggleSidebar();
            
            if(navigate) {
                folderStack = [{ id: ROOT_FOLDER_ID, name: cat }];
                localStorage.setItem('appFolderStack', JSON.stringify(folderStack));
                history.pushState({ id: ROOT_FOLDER_ID }, '', ''); 
                loadFolder(ROOT_FOLDER_ID, cat);
            }
        }

        fabMain.addEventListener('click', () => {
            fabMenu.classList.toggle('hidden');
            fabMenu.classList.toggle('flex');
            fabIcon.classList.toggle('fa-plus');
            fabIcon.classList.toggle('fa-times');
            fabIcon.style.transform = fabMenu.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(135deg)';
            fabIcon.style.transition = '0.3s';
        });

        btnBack.addEventListener('click', () => {
            if (folderStack.length > 1) {
                history.back(); // Gọi native back để đồng bộ history state
            }
        });

        function updateBreadcrumbs() {
            if (folderStack.length === 1) {
                currentFolderName.innerHTML = currentCategory;
                btnBack.classList.add('hidden');
                btnMenu.classList.remove('hidden');
                btnOpenDesign.classList.add('hidden');
            } else {
                currentFolderName.innerHTML = folderStack.map((f, i) => {
                    if (i === folderStack.length - 1) return `<span class="font-bold">${f.name}</span>`;
                    return `<span class="font-normal opacity-70 cursor-pointer" onclick="loadFolder('${f.id}','${f.name}')">${f.name}</span>`;
                }).join(' <i class="fas fa-chevron-right text-[10px] mx-1 opacity-50"></i> ');

                btnBack.classList.remove('hidden');
                btnMenu.classList.add('hidden');
                btnOpenDesign.classList.remove('hidden');
            }
        }

        // ĐÃ SỬA: Bổ sung redirect: 'follow' để PWA icon app không bị nghẽn mạng hoặc kẹt khi chuyển hướng
        async function apiCall(action, payload = {}) {
            if(action !== 'getMeta') loading.classList.remove('hidden');
            payload.action = action; 
            if (!payload.folderId) payload.folderId = currentFolderId;
            try {
                const response = await fetch(SCRIPT_URL, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload),
                    redirect: 'follow'
                });
                const data = await response.json();
                if(action !== 'getMeta') loading.classList.add('hidden'); 
                return data;
            } catch (error) {
                if(action !== 'getMeta') loading.classList.add('hidden'); 
                return { success: false };
            }
        }

        async function loadFolder(folderId, folderName, isNewNavigation = false, isPopState = false) {
            currentFolderId = folderId;
            
            if (isNewNavigation && !isPopState) { 
                const existingIdx = folderStack.findIndex(f => f.id === folderId);
                if(existingIdx !== -1) {
                    folderStack = folderStack.slice(0, existingIdx + 1);
                } else {
                    folderStack.push({ id: folderId, name: folderName }); 
                }
                localStorage.setItem('appFolderStack', JSON.stringify(folderStack)); 
                history.pushState({ id: folderId }, '', ''); 
            }
            updateBreadcrumbs(); 
            searchInput.value = ''; 
            clearSearchBtn.classList.add('hidden');
            
            folderListEl.innerHTML = '';
            fileListEl.innerHTML = '';

            const cachedData = localStorage.getItem(`folder_${folderId}`);
            if (cachedData) {
                currentDriveItems = JSON.parse(cachedData);
                renderItems(currentDriveItems);
            } else {
                folderListEl.innerHTML = '<div class="text-center text-gray-500 mt-10 w-full"><div class="loader mx-auto mb-3 border-blue-400"></div>Đang tải dữ liệu...</div>';
            }

            const res = await apiCall('list');
            if (res && res.success) { 
                currentDriveItems = res.data;
                localStorage.setItem(`folder_${folderId}`, JSON.stringify(currentDriveItems)); 
                renderItems(currentDriveItems); 
            } else {
                if (!cachedData) {
                    folderListEl.innerHTML = `<div class="text-center text-red-500 mt-10 w-full">Lỗi kết nối. Vui lòng thử lại.</div>`;
                }
            }
        }

        let searchTimeout;
        let lastSearchResults = JSON.parse(sessionStorage.getItem('lastSearchResults')) || null;
        let lastSearchKeyword = sessionStorage.getItem('lastSearchKeyword') || '';

        function clearSearch() {
            searchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            sessionStorage.removeItem('lastSearchResults');
            sessionStorage.removeItem('lastSearchKeyword');
            renderItems(currentDriveItems);
        }

        searchInput.addEventListener('input', (e) => {
            const keyword = e.target.value.trim().toLowerCase();
            clearTimeout(searchTimeout);
            
            if(!keyword) {
                clearSearchBtn.classList.add('hidden');
                renderItems(currentDriveItems);
                return;
            }
            
            clearSearchBtn.classList.remove('hidden');
            
            if(keyword === lastSearchKeyword && lastSearchResults) {
                renderItems(lastSearchResults, true);
                return;
            }

            searchTimeout = setTimeout(async () => {
                folderListEl.innerHTML = '<div class="text-center mt-8"><div class="loader mx-auto border-blue-400 mb-2"></div><p class="text-sm text-gray-500 font-semibold">Đang quét đệ quy sâu thư mục gốc...</p></div>';
                fileListEl.innerHTML = '';
                
                const res = await apiCall('globalSearch', { keyword: keyword });
                if(res && res.success) {
                    lastSearchResults = res.data;
                    lastSearchKeyword = keyword;
                    sessionStorage.setItem('lastSearchResults', JSON.stringify(res.data));
                    sessionStorage.setItem('lastSearchKeyword', keyword);
                    renderItems(res.data, true);
                } else {
                    folderListEl.innerHTML = '<div class="text-center text-gray-400 mt-8 w-full italic">Không có kết quả trong phạm vi ứng dụng.</div>';
                }
            }, 800);
        });

        window.toggleItemMenu = function(id, e) {
            e.stopPropagation();
            document.querySelectorAll('.item-action-menu').forEach(menu => {
                if (menu.id !== `menu-${id}`) menu.classList.add('hidden');
            });
            document.getElementById(`menu-${id}`).classList.toggle('hidden');
        };

        document.addEventListener('click', (e) => {
            document.querySelectorAll('.item-action-menu').forEach(menu => menu.classList.add('hidden'));
            if(!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
            }
            if(!e.target.closest('.custom-select-wrapper')) {
                document.getElementById('customSelectOptions').classList.remove('open');
            }
        });

        window.downloadItem = async function(id, type, name, e) {
            if(e) e.stopPropagation();
            document.querySelectorAll('.item-action-menu').forEach(m => m.classList.add('hidden'));
            
            if(type === 'folder') {
                showToast(`<i class="fas fa-spinner fa-spin mr-2"></i> Đang chuẩn bị nén thư mục "${name}"...`);
                const res = await apiCall('list', { folderId: id });
                if(res && res.success && res.data.length > 0) {
                    const filesToZip = res.data.filter(i => i.type !== 'folder'); 
                    if(filesToZip.length === 0) {
                        showToast(`Thư mục trống, không có tệp để tải!`); return;
                    }
                    showToast(`<i class="fas fa-spinner fa-spin mr-2"></i> Đang tải ${filesToZip.length} tệp để nén...`);
                    
                    const zip = new JSZip();
                    let successCount = 0;
                    for(let f of filesToZip) {
                        try {
                            const b64Res = await apiCall('getFileBase64', { fileId: f.id });
                            if(b64Res.success && b64Res.data) {
                                zip.file(f.name, b64Res.data, {base64: true});
                                successCount++;
                            }
                        } catch(err) {}
                    }
                    if(successCount > 0) {
                        showToast(`<i class="fas fa-spinner fa-spin mr-2"></i> Đang tạo file Zip...`);
                        zip.generateAsync({type:"blob"}).then(function(content) {
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(content);
                            link.download = `${name}.zip`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            showToast(`<i class="fas fa-check mr-2"></i> Đã tải xong thư mục ${name}`);
                        });
                    } else {
                        showToast(`Lỗi: Không thể lấy dữ liệu các tệp.`, true);
                    }
                } else {
                    showToast(`Thư mục trống hoặc bị lỗi.`, true);
                }
            } else {
                showToast(`<i class="fas fa-download mr-2"></i> Đang nạp tệp ${name}...`);
                try {
                    const b64Res = await apiCall('getFileBase64', { fileId: id });
                    if(b64Res.success && b64Res.data && b64Res.mimeType) {
                        const byteCharacters = atob(b64Res.data);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], {type: b64Res.mimeType});
                        
                        const fileObj = new File([blob], name, { type: b64Res.mimeType });
                        if (navigator.canShare && navigator.canShare({ files: [fileObj] })) {
                            try {
                                await navigator.share({
                                    files: [fileObj],
                                    title: name
                                });
                                showToast(`<i class="fas fa-check mr-2"></i> Đã chia sẻ/lưu tệp.`);
                                return;
                            } catch (shareErr) {
                                console.log("Người dùng hủy share hoặc lỗi", shareErr);
                            }
                        }

                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        showToast(`<i class="fas fa-check mr-2"></i> Đã tải xong tệp.`);
                    } else {
                        throw new Error("Không lấy được dữ liệu tệp.");
                    }
                } catch(e) {
                    showToast(`Đang tải tệp lớn ngầm trong App...`, true);
                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = `https://drive.google.com/uc?export=download&id=${id}`;
                    document.body.appendChild(iframe);
                    setTimeout(() => document.body.removeChild(iframe), 15000);
                }
            }
        }

        let currentEditId = null;
        let currentEditLevel = null;
        let currentEditType = null;
        
        window.openInfo = function(id, name, itemType, level, e) {
            e.stopPropagation();
            document.getElementById(`menu-${id}`).classList.add('hidden');
            currentEditId = id;
            currentEditLevel = level;
            currentEditType = itemType;
            
            const meta = getMeta(id);
            
            document.getElementById('infoName').value = name;
            
            let currentType = meta.type || currentCategory;
            hiddenTypeInput.value = currentType;
            selectValueDiv.querySelector('span').textContent = currentType;

            document.getElementById('infoDesc').value = meta.desc || '';
            
            document.getElementById('infoCoverInput').value = '';
            const previewImg = document.getElementById('infoCoverPreview');
            const placeholder = document.getElementById('infoCoverPlaceholder');
            
            if (meta.cover) {
                previewImg.src = meta.cover;
                previewImg.classList.remove('hidden');
                placeholder.classList.add('hidden');
            } else {
                previewImg.src = '';
                previewImg.classList.add('hidden');
                placeholder.classList.remove('hidden');
            }

            document.getElementById('info-field-type').classList.add('hidden');
            document.getElementById('info-field-desc').classList.add('hidden');
            document.getElementById('info-field-cover').classList.add('hidden');
            
            if (level === 'mega') {
                document.getElementById('info-field-type').classList.remove('hidden');
                document.getElementById('info-field-desc').classList.remove('hidden');
            } else if (level === 'sub') {
                document.getElementById('info-field-desc').classList.remove('hidden');
                document.getElementById('info-field-cover').classList.remove('hidden');
            } 

            document.getElementById('infoModal').classList.remove('hidden');
            document.getElementById('infoModal').classList.add('flex');
        };

        function closeInfoModal() {
            document.getElementById('infoModal').classList.add('hidden');
            document.getElementById('infoModal').classList.remove('flex');
        }

        // ĐOẠN PATCH SỬ DỤNG GIAO DIỆN CHỌN ẢNH NATIVE KHI Ở TRONG PWA 
        (function(){
            async function pickLocalFiles({ accept = 'image/*', multiple = true, callback }) {
                try {
                    if(window.showOpenFilePicker) {
                        const pickerTypes = [];
                        if(accept.includes('image')){
                            pickerTypes.push({
                                description: 'Images',
                                accept: {
                                    'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif']
                                }
                            });
                        }
                        if(accept.includes('video')){
                            pickerTypes.push({
                                description: 'Videos',
                                accept: {
                                    'video/*': ['.mp4', '.mov', '.webm', '.mkv']
                                }
                            });
                        }
                        const handles = await window.showOpenFilePicker({
                            multiple,
                            excludeAcceptAllOption: true,
                            types: pickerTypes
                        });
                        const files = [];
                        for(const handle of handles){
                            const file = await handle.getFile();
                            files.push(file);
                        }
                        callback({ target: { files } });
                        return;
                    }
                } catch(err) {
                    console.log('Native picker fallback:', err);
                }

                const input = document.createElement('input');
                input.type = 'file';
                input.accept = accept;
                input.multiple = multiple;
                input.style.display = 'none';
                document.body.appendChild(input);
                input.addEventListener('change', callback);
                input.click();
                setTimeout(()=>{ input.remove(); }, 10000);
            }

            // Gắn patch cho nút Chọn Ảnh Xem Trước trong Popup Info (Bọc arrow function tránh lỗi hoisting)
            const infoCoverWrapper = document.getElementById('infoCoverWrapper');
            if(infoCoverWrapper){
                infoCoverWrapper.onclick = async function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    await pickLocalFiles({
                        accept: 'image/*',
                        multiple: false,
                        callback: (ev) => window.handleCoverUpload(ev)
                    });
                };
            }

            // Gắn patch cho mục Up Ảnh
            const uploadImageLabel = document.querySelector('label:has(#uploadImage)');
            if(uploadImageLabel){
                uploadImageLabel.onclick = async function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    await pickLocalFiles({
                        accept:'image/*',
                        multiple:true,
                        callback:handleMultipleFileUpload
                    });
                };
            }

            // Gắn patch cho mục Up Video
            const uploadVideoLabel = document.querySelector('label:has(#uploadVideo)');
            if(uploadVideoLabel){
                uploadVideoLabel.onclick = async function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    await pickLocalFiles({
                        accept:'video/*',
                        multiple:true,
                        callback:handleMultipleFileUpload
                    });
                };
            }

            // Gắn patch cho nút Up ảnh mới (Watermark)
            const wmBtn = document.getElementById('btn-upload-wm-local');
            if(wmBtn){
                wmBtn.onclick = async function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    await pickLocalFiles({
                        accept:'image/*',
                        multiple:false,
                        callback:function(ev){
                            const f = ev.target.files[0];
                            if(!f) return;
                            const r = new FileReader();
                            r.onload = function(evt){
                                state.savedWatermarks.push(evt.target.result);
                                saveStorageWMs();
                                const sI = generateId();
                                getTargetImages().forEach(i=>{
                                    i.wms.push(createWm(evt.target.result,sI));
                                });
                                state.layerOrder.push({ id:sI, type:'wm' });
                                state.activeElementId = sI;
                                state.activeEditTarget = 'wm';
                                document.querySelector(`input[name="adjust-target"][value="wm"]`).checked=true;
                                renderWMLibrary();
                                renderImages();
                                renderLayers();
                                syncSliders();
                            };
                            r.readAsDataURL(f);
                        }
                    });
                };
            }
        })();

        // ĐÃ SỬA: Ép kích thước ảnh xem trước thành dạng Thumbnail nhỏ gọn, tránh tràn bộ nhớ kí tự Google Sheets
        window.handleCoverUpload = function(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    // Chuyển về dạng ảnh icon cực gọn (Đủ hiển thị đẹp trên w-12 h-12, dung lượng Base64 siêu nhẹ)
                    const MAX_WIDTH = 120;
                    const MAX_HEIGHT = 120;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    } else {
                        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Thiết lập chất lượng ảnh nén JPEG là 0.6 để cắt giảm tối đa số lượng ký tự Base64
                    const b64 = canvas.toDataURL('image/jpeg', 0.6);
                    
                    document.getElementById('infoCoverPreview').src = b64;
                    document.getElementById('infoCoverPreview').classList.remove('hidden');
                    document.getElementById('infoCoverPlaceholder').classList.add('hidden');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        };

        document.getElementById('infoSaveBtn').addEventListener('click', () => {
            if(!currentEditId) return closeInfoModal();
            
            const newName = document.getElementById('infoName').value.trim();
            const newType = document.getElementById('infoType').value;
            const newDesc = document.getElementById('infoDesc').value.trim();
            
            let newCover = document.getElementById('infoCoverPreview').src;
            if(!newCover.startsWith('data:')) newCover = appMeta[currentEditId]?.cover || '';

            appMeta[currentEditId] = { type: newType, desc: newDesc, cover: newCover, name: newName };
            saveLocalMeta();

            const oldItem = currentDriveItems.find(i => i.id === currentEditId) || 
                            Object.values(subFolderCache).flat().find(i => i.id === currentEditId);

            let nameChanged = false;
            if (newName && oldItem && newName !== oldItem.name) {
                oldItem.name = newName;
                nameChanged = true;
            }

            renderItems(currentDriveItems);
            closeInfoModal();
            showToast(`<i class="fas fa-check mr-2"></i> Đã lưu cài đặt`);

            bgApiCall('updateSingleMeta', {
                meta: { id: currentEditId, name: newName, type: newType, desc: newDesc, cover: newCover }
            });

            if (nameChanged) {
                bgApiCall('rename', { id: currentEditId, newName: newName, type: currentEditType });
            }
        });

        window.handleDelete = function(id, type, e) {
            e.stopPropagation();
            document.getElementById(`menu-${id}`).classList.add('hidden');
            
            document.getElementById('modalTitle').textContent = 'Xác nhận xóa';
            document.getElementById('modalDesc').textContent = 'Bạn có chắc chắn muốn xóa mục này? Hành động này không thể hoàn tác.';
            document.getElementById('modalDesc').classList.remove('hidden');
            document.getElementById('modalInput').classList.add('hidden');
            
            const btn = document.getElementById('modalConfirmBtn');
            btn.textContent = 'Xóa';
            btn.className = 'px-5 py-2 bg-red-600 text-white font-bold rounded-xl';
            
            btn.onclick = () => {
                currentDriveItems = currentDriveItems.filter(i => i.id !== id);
                for(let megaId in subFolderCache) {
                    subFolderCache[megaId] = subFolderCache[megaId].filter(i => i.id !== id);
                }
                localStorage.setItem(`folder_${currentFolderId}`, JSON.stringify(currentDriveItems));
                renderItems(currentDriveItems);
                closeModal();
                showToast(`<i class="fas fa-trash mr-2"></i> Đã xóa thành công`);
                
                bgApiCall('delete', { id: id, type: type });
            };
            
            document.getElementById('customModal').classList.remove('hidden');
            document.getElementById('customModal').classList.add('flex');
        };

        function closeModal() {
            document.getElementById('customModal').classList.add('hidden');
            document.getElementById('customModal').classList.remove('flex');
        }

        window.toggleAccordion = async function(id, forceOpen = false) {
            const body = document.getElementById(`acc-${id}`);
            const icon = document.getElementById(`icon-${id}`);
            const isHidden = body.classList.contains('hidden');
            
            if(isHidden || forceOpen) {
                body.classList.remove('hidden');
                icon.style.transform = 'rotate(90deg)';
                
                if(!expandedMegas.includes(id)) {
                    expandedMegas.push(id);
                    localStorage.setItem('expandedMegas', JSON.stringify(expandedMegas));
                }
                
                if(!subFolderCache[id]) {
                    body.innerHTML = '<div class="text-center text-blue-400 py-3 text-sm"><div class="loader mx-auto border-blue-400 mb-1" style="width:16px;height:16px;"></div>Tải...</div>';
                    const res = await apiCall('list', { folderId: id });
                    if(res && res.success) {
                        subFolderCache[id] = res.data.filter(i => i.type === 'folder'); 
                        renderSubFolders(id, subFolderCache[id]);
                    } else {
                        body.innerHTML = '<div class="text-center text-gray-400 py-3 text-sm">Lỗi tải dữ liệu</div>';
                    }
                } else {
                    renderSubFolders(id, subFolderCache[id]);
                }
            } else {
                body.classList.add('hidden');
                icon.style.transform = 'rotate(0deg)';
                expandedMegas = expandedMegas.filter(m => m !== id);
                localStorage.setItem('expandedMegas', JSON.stringify(expandedMegas));
            }
        };

        function renderSubFolders(megaId, subFolders) {
            const container = document.getElementById(`acc-${megaId}`);
            if(subFolders.length === 0) {
                container.innerHTML = '<div class="pl-14 py-3 text-sm text-gray-400 italic">Trống</div>';
                return;
            }
            
            container.innerHTML = subFolders.map(item => {
                const meta = getMeta(item.id);
                const imgHtml = `
                    <img src="${meta.cover || ''}" class="w-12 h-12 rounded-lg object-cover flex-shrink-0 shadow-sm item-cover-img-${item.id} ${meta.cover ? '' : 'hidden'}">
                    <div class="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-500 text-xl item-cover-icon-${item.id} ${meta.cover ? 'hidden' : ''}"><i class="fas fa-folder"></i></div>
                `;
                
                return `
                <div class="subfolder-row group" onclick="loadFolder('${item.id}', '${item.name}', true)">
                    ${imgHtml}
                    <div class="flex-1 overflow-hidden">
                        <h4 class="text-sm font-bold text-gray-800 truncate item-name-${item.id}">${item.name}</h4>
                        <p class="text-[11px] text-gray-500 truncate mt-0.5 item-desc-${item.id} ${meta.desc ? '' : 'hidden'}">${meta.desc || 'Chưa có mô tả'}</p>
                    </div>
                    <div class="relative" onclick="event.stopPropagation()">
                        <button onclick="window.toggleItemMenu('${item.id}', event)" class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-600 rounded-full transition"><i class="fas fa-ellipsis-v"></i></button>
                        <div id="menu-${item.id}" class="hidden absolute right-0 mt-1 w-44 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-1.5 text-sm item-action-menu overflow-hidden">
                            <div class="px-5 py-3 hover:bg-gray-50 cursor-pointer text-gray-700 font-semibold transition flex items-center" onclick="window.uiPromptFolder('${item.id}', event)"><i class="fas fa-folder-plus mr-3 text-green-500 w-4"></i>Thư mục con</div>
                            <div class="px-5 py-3 hover:bg-gray-50 cursor-pointer text-gray-700 font-semibold transition flex items-center" onclick="window.openInfo('${item.id}', '${item.name}', '${item.type}', 'sub', event)"><i class="fas fa-info-circle mr-3 text-blue-500 w-4"></i>Thông tin</div>
                            <div class="px-5 py-3 hover:bg-gray-50 cursor-pointer text-gray-700 font-semibold transition flex items-center" onclick="window.downloadItem('${item.id}', '${item.type}', '${item.name}', event)"><i class="fas fa-download mr-3 text-blue-500 w-4"></i>Tải xuống</div>
                            <div class="px-5 py-3 hover:bg-red-50 cursor-pointer text-red-600 font-semibold transition border-t border-gray-50 flex items-center" onclick="window.handleDelete('${item.id}', '${item.type}', event)"><i class="fas fa-trash mr-3 w-4"></i>Xóa</div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }

        function renderItems(items, isSearchMode = false) {
            folderListEl.innerHTML = '';
            fileListEl.innerHTML = '';
            
            if (items.length === 0) {
                folderListEl.innerHTML = '<div class="text-center text-gray-400 mt-8 w-full italic">Không có dữ liệu.</div>';
                return;
            }

            if (folderStack.length === 1 && !isSearchMode) {
                const megaRows = items.filter(i => i.type === 'folder' && getMeta(i.id).type === currentCategory);
                if (megaRows.length === 0) {
                    folderListEl.innerHTML = `<div class="text-center text-gray-400 mt-8 w-full italic">Chưa có dữ liệu trong mục ${currentCategory}</div>`;
                    return;
                }
                
                folderListEl.innerHTML = megaRows.map(item => {
                    const meta = getMeta(item.id);
                    return `
                    <div class="mega-row">
                        <div class="mega-header" onclick="window.toggleAccordion('${item.id}')">
                            <div class="flex items-center gap-3 overflow-hidden">
                                <i id="icon-${item.id}" class="fas fa-chevron-right text-gray-400 text-sm transition-transform duration-200 w-4 text-center"></i>
                                <div class="flex flex-col overflow-hidden">
                                    <span class="truncate uppercase text-blue-800 item-name-${item.id}">${item.name}</span>
                                    <span class="text-[11px] font-normal text-gray-500 truncate mt-1 item-desc-${item.id} ${meta.desc ? '' : 'hidden'}">${meta.desc || ''}</span>
                                </div>
                            </div>
                            <div class="relative flex-shrink-0" onclick="event.stopPropagation()">
                                <button onclick="window.toggleItemMenu('${item.id}', event)" class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-600 bg-gray-50 rounded-full transition"><i class="fas fa-ellipsis-v"></i></button>
                                <div id="menu-${item.id}" class="hidden absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-1.5 text-sm item-action-menu overflow-hidden">
                                    <div class="px-5 py-3 hover:bg-gray-50 cursor-pointer text-gray-700 font-semibold transition flex items-center" onclick="window.openInfo('${item.id}', '${item.name}', '${item.type}', 'mega', event)"><i class="fas fa-info-circle mr-3 text-blue-500 w-4"></i>Thông tin</div>
                                    <div class="px-5 py-3 hover:bg-gray-50 cursor-pointer text-green-600 font-semibold transition border-t border-gray-50 flex items-center" onclick="window.uiPromptFolder('${item.id}', event)"><i class="fas fa-folder-plus mr-3 w-4"></i>Thêm thư mục con</div>
                                    <div class="px-5 py-3 hover:bg-gray-50 cursor-pointer text-gray-700 font-semibold transition border-t border-gray-50 flex items-center" onclick="window.downloadItem('${item.id}', '${item.type}', '${item.name}', event)"><i class="fas fa-download mr-3 text-blue-500 w-4"></i>Tải xuống</div>
                                    <div class="px-5 py-3 hover:bg-red-50 cursor-pointer text-red-600 font-semibold transition border-t border-gray-50 flex items-center" onclick="window.handleDelete('${item.id}', '${item.type}', event)"><i class="fas fa-trash mr-3 w-4"></i>Xóa</div>
                                </div>
                            </div>
                        </div>
                        <div id="acc-${item.id}" class="hidden bg-white border-t border-gray-100"></div>
                    </div>`;
                }).join('');
                
                megaRows.forEach(row => {
                    if(expandedMegas.includes(row.id)) window.toggleAccordion(row.id, true);
                });
            } 
            else {
                const folders = items.filter(i => i.type === 'folder');
                const files = items.filter(i => i.type !== 'folder');

                if(folders.length > 0) {
                    folderListEl.innerHTML = folders.map(item => `
                    <div class="bg-white p-4 border-b border-gray-200 flex items-center justify-between cursor-pointer" onclick="loadFolder('${item.id}', '${item.name}', true)">
                        <div class="flex items-center gap-3">
                            <i class="fas fa-folder text-blue-500 text-2xl"></i>
                            <span class="font-bold text-gray-800 item-name-${item.id}">${item.name}</span>
                        </div>
                        <div class="relative" onclick="event.stopPropagation()">
                            <button onclick="window.toggleItemMenu('${item.id}', event)" class="px-3 py-2 text-gray-400"><i class="fas fa-ellipsis-v"></i></button>
                            <div id="menu-${item.id}" class="hidden absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border z-50 py-1 text-sm item-action-menu">
                                <div class="px-4 py-3 hover:bg-gray-50 cursor-pointer font-semibold text-gray-700 flex items-center" onclick="window.openInfo('${item.id}', '${item.name}', '${item.type}', 'sub', event)"><i class="fas fa-pen mr-3 text-blue-500 w-4"></i>Sửa</div>
                                <div class="px-4 py-3 hover:bg-gray-50 cursor-pointer font-semibold text-gray-700 border-t flex items-center" onclick="window.downloadItem('${item.id}', '${item.type}', '${item.name}', event)"><i class="fas fa-download mr-3 text-blue-500 w-4"></i>Tải xuống</div>
                                <div class="px-4 py-3 hover:bg-red-50 text-red-600 cursor-pointer font-semibold border-t flex items-center" onclick="window.handleDelete('${item.id}', '${item.type}', event)"><i class="fas fa-trash mr-3 w-4"></i>Xóa</div>
                            </div>
                        </div>
                    </div>`).join('');
                }

                fileListEl.innerHTML = files.map(item => {
                    let isImage = item.mimeType.includes('image');
                    let imgUrl = item.tempUrl ? item.tempUrl : `https://drive.google.com/thumbnail?id=${item.id}&sz=w400`;
                    let fullImgUrl = item.tempUrl ? item.tempUrl : `https://drive.google.com/thumbnail?id=${item.id}&sz=w2000`;
                    
                    let visualEl = isImage 
                        ? `<img src="${imgUrl}" data-url="${fullImgUrl}" class="w-full h-full object-cover drive-img-item" loading="lazy">` 
                        : `<div class="w-full h-full flex items-center justify-center bg-gray-50"><i class="fas fa-play-circle text-gray-400 text-4xl"></i></div>`;
                    
                    let isTemp = item.tempUrl ? `<div class="absolute inset-0 bg-white/60 flex flex-col items-center justify-center backdrop-blur-[2px] z-10 rounded-2xl"><div class="loader mb-2 border-blue-600"></div><span class="text-[10px] font-bold text-blue-600">Đang Up...</span></div>` : '';

                    return `
                    <div class="bg-white p-2.5 rounded-2xl shadow-sm border border-gray-100 flex flex-col relative hover:shadow-md transition">
                        ${isTemp}
                        <div class="absolute top-2 right-2 z-20">
                            <button onclick="window.toggleItemMenu('${item.id}', event)" class="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-600 bg-white/90 backdrop-blur-md rounded-full shadow-sm"><i class="fas fa-ellipsis-v"></i></button>
                            <div id="menu-${item.id}" class="hidden absolute right-0 mt-1 w-40 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-1 text-sm item-action-menu overflow-hidden">
                                <div class="px-4 py-3 hover:bg-gray-50 cursor-pointer text-gray-700 font-semibold flex items-center" onclick="window.downloadItem('${item.id}', '${item.type}', '${item.name}', event)"><i class="fas fa-download mr-3 text-blue-500 w-4"></i>Tải xuống</div>
                                <div class="px-4 py-3 hover:bg-gray-50 cursor-pointer text-gray-700 font-semibold border-t flex items-center" onclick="window.openInfo('${item.id}', '${item.name}', '${item.type}', 'file', event)"><i class="fas fa-pen mr-3 text-blue-500 w-4"></i>Sửa</div>
                                <div class="px-4 py-3 hover:bg-red-50 cursor-pointer text-red-600 font-semibold border-t flex items-center" onclick="window.handleDelete('${item.id}', '${item.type}', event)"><i class="fas fa-trash mr-3 w-4"></i>Xóa</div>
                            </div>
                        </div>
                        
                        <div class="w-full h-32 flex items-center justify-center bg-gray-100 rounded-xl overflow-hidden cursor-pointer mb-3" onclick="openMedia('${item.id}', '${item.mimeType}', '${item.name}', '${fullImgUrl}')">
                            ${visualEl}
                        </div>
                        
                        <div class="px-1 flex flex-col justify-center flex-1">
                            <span class="text-[13px] font-bold text-gray-800 line-clamp-2 leading-tight drive-img-name item-name-${item.id}" title="${item.name}">${item.name}</span>
                            <span class="text-[10px] text-gray-400 mt-1 uppercase font-semibold">${item.mimeType.split('/')[1] || 'FILE'}</span>
                        </div>
                    </div>`;
                }).join('');
            }
        }