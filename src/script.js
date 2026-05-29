        const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwQ1jyePOExK9YbdU3LykeAoy_FqLmZNl7WKVRTV1G6BJ1zzAeE_tUReM-rswzupdU/exec";
        const ROOT_FOLDER_ID = "1xWDed1IBzGdCA4r5vbds1x6AF31hSIUT";
        
        const WM_FOLDER_ID = "1P_YxqI3LzWB4GhM2H7Sk05KrISjIpVc7";

        let savedStack = localStorage.getItem('appFolderStack');
        let folderStack = savedStack ? JSON.parse(savedStack) : [{ id: ROOT_FOLDER_ID, name: "Triển khai", scrollTop: 0 }];
        let currentFolderId = folderStack[folderStack.length - 1].id;
        
        let currentDriveItems = [];
        let subFolderCache = {}; 
        let folderDataCache = {}; 
        
        let appMeta = JSON.parse(localStorage.getItem('vinhloc_meta')) || {};
        
        let metaCleaned = false;
        for (let id in appMeta) {
            if (appMeta[id].cover && appMeta[id].cover.length > 30000) {
                appMeta[id].cover = ''; 
                metaCleaned = true;
            }
        }
        if (metaCleaned) {
            try { localStorage.setItem('vinhloc_meta', JSON.stringify(appMeta)); } catch(e){}
        }

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
                syncText.textContent = 'Đang lưu...';
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
            
            return fetch(SCRIPT_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload),
                redirect: 'follow'
            })
            .then(res => res.json())
            .then(data => {
                if(!data.success) console.error("Lỗi từ Google Apps Script:", data.error || data.message);
                return data;
            })
            .catch(err => {
                console.error("Lỗi kết nối mạng:", err);
                return { success: false };
            })
            .finally(() => {
                syncQueueCount--;
                updateSyncIndicator();
            });
        }

        function smoothUpdateUI(newMeta) {
            for (let id in newMeta) {
                const meta = newMeta[id];

                let targetInCurrent = currentDriveItems.find(i => i.id === id);
                if (targetInCurrent && meta.name) targetInCurrent.name = meta.name;

                for (let megaId in subFolderCache) {
                    let targetInSub = subFolderCache[megaId].find(i => i.id === id);
                    if (targetInSub && meta.name) targetInSub.name = meta.name;
                }
                
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
                    }
                    if(meta.desc) el.classList.remove('hidden');
                    else el.classList.add('hidden');
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
                        saveLocalMeta(); 
                        smoothUpdateUI(appMeta);
                        if (folderStack.length === 1) {
                            renderItems(currentDriveItems);
                        }
                    }
                }
            } catch (e) {}
        }

        async function silentFetchFolder() {
            if (!currentFolderId || syncQueueCount > 0) return;
            
            try {
                const hasTempItems = currentDriveItems.some(i => String(i.id).startsWith('temp_'));
                if (!hasTempItems) {
                    const res = await fetch(SCRIPT_URL, { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({ action: 'list', folderId: currentFolderId })
                    }).then(r => r.json());

                    if (res && res.success && res.data) {
                        const currentIds = currentDriveItems.map(i => i.id).sort().join(',');
                        const newIds = res.data.map(i => i.id).sort().join(',');
                        
                        if (currentIds !== newIds) {
                            currentDriveItems = res.data;
                            folderDataCache[currentFolderId] = currentDriveItems;
                            const currentScroll = document.getElementById('contentArea').scrollTop;
                            renderItems(currentDriveItems);
                            document.getElementById('contentArea').scrollTop = currentScroll;
                        }
                    }
                }

                if (folderStack.length === 1 && expandedMegas.length > 0) {
                    for (let megaId of expandedMegas) {
                        const hasTempSub = (subFolderCache[megaId] || []).some(i => String(i.id).startsWith('temp_'));
                        if (hasTempSub) continue;

                        const subRes = await fetch(SCRIPT_URL, { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify({ action: 'list', folderId: megaId })
                        }).then(r => r.json());

                        if (subRes && subRes.success && subRes.data) {
                            const newSubFolders = subRes.data.filter(i => i.type === 'folder');
                            const currentSubIds = (subFolderCache[megaId] || []).map(i => i.id).sort().join(',');
                            const newSubIds = newSubFolders.map(i => i.id).sort().join(',');

                            if (currentSubIds !== newSubIds) {
                                subFolderCache[megaId] = newSubFolders;
                                renderSubFolders(megaId, newSubFolders);
                            }
                        }
                    }
                }
            } catch (e) { }
        }

        setInterval(() => {
            if (document.getElementById('infoModal').classList.contains('hidden') && syncQueueCount === 0) {
                silentFetchMeta();
                silentFetchFolder();
            }
        }, 5000);

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" && syncQueueCount === 0) {
                silentFetchMeta();
                silentFetchFolder();
            }
        });

        function saveLocalMeta() { 
            try {
                localStorage.setItem('vinhloc_meta', JSON.stringify(appMeta)); 
            } catch (e) {
                console.warn("LocalStorage đã đầy.");
            }
        }

        function getMeta(id) { 
            return appMeta[id] || { type: 'Triển khai', desc: '', cover: '' };
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
                folderStack = [{ id: ROOT_FOLDER_ID, name: cat, scrollTop: 0 }];
                localStorage.setItem('appFolderStack', JSON.stringify(folderStack));
                history.pushState({ id: ROOT_FOLDER_ID }, '', ''); 
                loadFolder(ROOT_FOLDER_ID, cat, false, false);
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
                history.back();
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

        async function apiCall(action, payload = {}) {
            if(action !== 'getMeta') loading.classList.remove('hidden');
            payload.action = action; 
            if (!payload.folderId) payload.folderId = currentFolderId;
            try {
                const response = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
                const data = await response.json();
                if(action !== 'getMeta') loading.classList.add('hidden'); 
                return data;
            } catch (error) {
                if(action !== 'getMeta') loading.classList.add('hidden'); 
                return { success: false };
            }
        }

        async function loadFolder(folderId, folderName, isNewNavigation = false, isPopState = false) {
            if (isNewNavigation && !isPopState) {
                if (folderStack.length > 0) {
                    folderStack[folderStack.length - 1].scrollTop = document.getElementById('contentArea').scrollTop;
                }
            }

            currentFolderId = folderId;
            
            if (isNewNavigation && !isPopState) { 
                const existingIdx = folderStack.findIndex(f => f.id === folderId);
                if(existingIdx !== -1) {
                    folderStack = folderStack.slice(0, existingIdx + 1);
                } else {
                    folderStack.push({ id: folderId, name: folderName, scrollTop: 0 }); 
                }
                localStorage.setItem('appFolderStack', JSON.stringify(folderStack)); 
                history.pushState({ id: folderId }, '', ''); 
            }
            updateBreadcrumbs(); 
            searchInput.value = ''; 
            clearSearchBtn.classList.add('hidden');

            const restoreScroll = () => {
                const targetStackItem = folderStack[folderStack.length - 1];
                if (targetStackItem && targetStackItem.scrollTop) {
                    setTimeout(() => {
                        document.getElementById('contentArea').scrollTop = targetStackItem.scrollTop;
                    }, 10); 
                } else {
                    document.getElementById('contentArea').scrollTop = 0;
                }
            };
            
            if (folderDataCache[folderId]) {
                currentDriveItems = folderDataCache[folderId];
                renderItems(currentDriveItems);
                restoreScroll();

                apiCall('list', { folderId: folderId }).then(res => {
                    if (res && res.success) {
                        if (JSON.stringify(folderDataCache[folderId]) !== JSON.stringify(res.data)) {
                            folderDataCache[folderId] = res.data;
                            if (currentFolderId === folderId) {
                                currentDriveItems = res.data;
                                const currentScroll = document.getElementById('contentArea').scrollTop;
                                renderItems(currentDriveItems);
                                document.getElementById('contentArea').scrollTop = currentScroll;
                            }
                        }
                    }
                });
            } else {
                folderListEl.innerHTML = '<div class="text-center text-gray-500 mt-10 w-full"><div class="loader mx-auto mb-3 border-blue-400"></div>Đang tải dữ liệu...</div>';
                fileListEl.innerHTML = '';

                const res = await apiCall('list', { folderId: folderId });
                if (res && res.success) { 
                    currentDriveItems = res.data;
                    folderDataCache[folderId] = res.data; 
                    renderItems(currentDriveItems); 
                    restoreScroll();
                } else {
                    folderListEl.innerHTML = '<div class="text-center text-gray-500 mt-10 w-full italic">Lỗi kết nối hoặc thư mục trống.</div>';
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

        const selectValueDiv = document.getElementById('customSelectValue');
        const selectOptionsDiv = document.getElementById('customSelectOptions');
        const hiddenTypeInput = document.getElementById('infoType');

        selectValueDiv.addEventListener('click', () => {
            selectOptionsDiv.classList.toggle('open');
        });

        document.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                const val = e.target.dataset.val;
                selectValueDiv.querySelector('span').textContent = val;
                hiddenTypeInput.value = val;
                selectOptionsDiv.classList.remove('open');
            });
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
                    showToast(`Đang tải...`, true);
                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = `https://drive.google.com/uc?export=download&id=${id}`;
                    document.body.appendChild(iframe);
                    setTimeout(() => document.body.removeChild(iframe), 15000);
                }
            }
        }

        window.shareItem = async function(id, type, name, e) {
            e.stopPropagation();
            document.querySelectorAll('.item-action-menu').forEach(menu => menu.classList.add('hidden'));
            
            // BỎ API makePublic vì thư mục gốc đã có quyền Anyone with the link
            let mimeTypeParam = '';
            if(type === 'file') {
                const fileObj = currentDriveItems.find(i => i.id === id);
                if(fileObj && fileObj.mimeType) {
                    mimeTypeParam = `&mimeType=${encodeURIComponent(fileObj.mimeType)}`;
                }
            }
            
            const shareUrl = `${window.location.origin}${window.location.pathname}?shareId=${id}&shareType=${type}&shareName=${encodeURIComponent(name)}${mimeTypeParam}`;
            
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: `Chia sẻ: ${name}`,
                        text: `Mở xem chi tiết "${name}" trong ứng dụng:`,
                        url: shareUrl
                    });
                } catch (err) {
                    console.log("Người dùng hủy share", err);
                }
            } else {
                navigator.clipboard.writeText(shareUrl).then(() => {
                    showToast(`<i class="fas fa-link mr-2"></i> Đã copy link vào khay nhớ tạm!`);
                }).catch(() => {
                    showToast(`Lỗi không thể copy link!`, true);
                });
            }
        };

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

            const infoCoverWrapper = document.getElementById('infoCoverWrapper');
            if(infoCoverWrapper){
                infoCoverWrapper.onclick = async function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    await pickLocalFiles({
                        accept: 'image/*',
                        multiple: false,
                        callback: window.handleCoverUpload
                    });
                };
            }

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

        })();

        window.handleCoverUpload = function(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const MAX_WIDTH = 150; 
                    const MAX_HEIGHT = 150;
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

                    const b64 = canvas.toDataURL('image/jpeg', 0.5); 
                    
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

            let nameChanged = false;
            
            const allSubItems = Object.values(subFolderCache).reduce((acc, arr) => acc.concat(arr), []);
            const oldItem = currentDriveItems.find(i => i.id === currentEditId) || allSubItems.find(i => i.id === currentEditId);
            
            if (newName && oldItem && newName !== oldItem.name) {
                nameChanged = true;
                folderDataCache[currentFolderId] = currentDriveItems; 
            }

            smoothUpdateUI(appMeta); 
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
                folderDataCache[currentFolderId] = currentDriveItems; 
                for(let megaId in subFolderCache) {
                    subFolderCache[megaId] = subFolderCache[megaId].filter(i => i.id !== id);
                }
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
                            <div class="px-5 py-3 hover:bg-gray-50 cursor-pointer text-gray-700 font-semibold transition flex items-center" onclick="window.uiPromptFolder('${item.id}', event)"><i class="fas fa-folder-plus mr-3 text-green-500 w-4"></i>Thêm mục</div>
                            <div class="px-5 py-3 hover:bg-gray-50 cursor-pointer text-gray-700 font-semibold transition flex items-center" onclick="window.shareItem('${item.id}', '${item.type}', '${item.name}', event)"><i class="fas fa-share-nodes mr-3 text-green-500 w-4"></i>Chia sẻ</div>
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
                                    <div class="px-5 py-3 hover:bg-gray-50 cursor-pointer text-green-600 font-semibold transition border-t border-gray-50 flex items-center" onclick="window.uiPromptFolder('${item.id}', event)"><i class="fas fa-folder-plus mr-3 w-4"></i>Thư mục</div>
                                    <div class="px-5 py-3 hover:bg-gray-50 cursor-pointer text-gray-700 font-semibold transition flex items-center" onclick="window.shareItem('${item.id}', '${item.type}', '${item.name}', event)"><i class="fas fa-share-nodes mr-3 text-green-500 w-4"></i>Chia sẻ</div>
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
                                <div class="px-4 py-3 hover:bg-gray-50 cursor-pointer font-semibold text-gray-700 flex items-center" onclick="window.shareItem('${item.id}', '${item.type}', '${item.name}', event)"><i class="fas fa-share-nodes mr-3 text-green-500 w-4"></i>Chia sẻ</div>
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
                                <div class="px-4 py-3 hover:bg-gray-50 cursor-pointer text-gray-700 font-semibold flex items-center" onclick="window.shareItem('${item.id}', '${item.type}', '${item.name}', event)"><i class="fas fa-share-nodes mr-3 text-green-500 w-4"></i>Chia sẻ</div>
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

        window.uiPromptFolder = function(targetParentId = null, e = null) {
            if(e) { e.stopPropagation(); document.querySelectorAll('.item-action-menu').forEach(menu => menu.classList.add('hidden')); }
            closeFab(); 
            
            document.getElementById('modalTitle').textContent = 'Thư mục mới';
            document.getElementById('modalDesc').classList.add('hidden'); 
            document.getElementById('modalInput').classList.remove('hidden'); 
            document.getElementById('modalInput').value = ''; 
            document.getElementById('modalInput').placeholder = "Nhập tên thư mục..."; 
            
            const btn = document.getElementById('modalConfirmBtn');
            btn.textContent = 'Lưu';
            btn.className = 'px-5 py-2 bg-blue-600 text-white font-bold rounded-xl';
            
            btn.onclick = async () => { 
                const val = document.getElementById('modalInput').value.trim(); 
                if (val) {
                    const parentIdToUse = (targetParentId && typeof targetParentId === 'string') ? targetParentId : currentFolderId;
                    
                    closeModal(); 
                    showToast(`<i class="fas fa-spinner fa-spin mr-2"></i> Đang tạo mục "${val}"...`);
                    
                    try {
                        const res = await apiCall('createFolder', { name: val, folderId: parentIdToUse });
                        
                        if (res && res.success) {
                            const realId = res.folderId || res.id;
                            const newItem = { id: realId, name: val, type: 'folder' };
                            
                            if (parentIdToUse === currentFolderId) {
                                if(folderStack.length === 1) {
                                    appMeta[realId] = { type: currentCategory, desc: '', cover: '' };
                                    saveLocalMeta();
                                    bgApiCall('updateSingleMeta', { meta: { id: realId, name: val, type: currentCategory, desc: '', cover: '' } });
                                }
                                currentDriveItems.unshift(newItem);
                                folderDataCache[currentFolderId] = currentDriveItems; 
                                renderItems(currentDriveItems);
                            } else if (subFolderCache[parentIdToUse]) {
                                subFolderCache[parentIdToUse].unshift(newItem);
                                renderSubFolders(parentIdToUse, subFolderCache[parentIdToUse]);
                            }
                            
                            showToast(`<i class="fas fa-check mr-2"></i> Đã tạo mục "${val}"`);
                        } else {
                            showToast(`Lỗi: Không thể tạo thư mục!`, true);
                        }
                    } catch (err) {
                        showToast(`Lỗi kết nối khi tạo thư mục!`, true);
                    }
                } 
            }; 
            document.getElementById('customModal').classList.remove('hidden');
            document.getElementById('customModal').classList.add('flex');
            setTimeout(() => document.getElementById('modalInput').focus(), 100); 
        }

        async function handleMultipleFileUpload(event) {
            closeFab();
            const files = event.target.files; 
            if (!files || files.length === 0) return;
            let tempFilesToUpload = [];

            for (let i = 0; i < files.length; i++) {
                let file = files[i];
                let fakeId = 'temp_file_' + Date.now() + i;
                let tempUrl = URL.createObjectURL(file); 
                let newItem = { id: fakeId, name: file.name, mimeType: file.type, type: 'file', tempUrl: tempUrl };
                tempFilesToUpload.push({ file: file, item: newItem });
                currentDriveItems.push(newItem); 
            }
            folderDataCache[currentFolderId] = currentDriveItems; 
            renderItems(currentDriveItems);

            for (let obj of tempFilesToUpload) {
                let reader = new FileReader();
                reader.onload = async function(e) {
                    let base64Data = e.target.result.split(',')[1];
                    let res = await apiCall('upload', { filename: obj.file.name, mimeType: obj.file.type, data: base64Data });
                    if (res && res.success) {
                        let idx = currentDriveItems.findIndex(i => i.id === obj.item.id);
                        if(idx > -1) {
                            currentDriveItems[idx].id = res.fileId || res.id;
                            delete currentDriveItems[idx].tempUrl;
                            folderDataCache[currentFolderId] = currentDriveItems; 
                            renderItems(currentDriveItems); 
                        }
                    }
                };
                reader.readAsDataURL(obj.file);
            }
            event.target.value = ''; 
        }

        let curMediaIdForDownload = null;
        let curMediaNameForDownload = null;
        function openMedia(id, mimeType, name, tempUrlFull = null) {
            closeFab(); document.getElementById('mediaTitle').textContent = name;
            curMediaIdForDownload = id;
            curMediaNameForDownload = name;
            
            document.getElementById('mediaViewer').classList.remove('hidden'); document.getElementById('mediaViewer').classList.add('flex');
            if (mimeType.includes('image')) { 
                let srcToUse = tempUrlFull && !tempUrlFull.includes('undefined') ? tempUrlFull : `https://drive.google.com/thumbnail?id=${id}&sz=w2000`;
                document.getElementById('mediaContent').innerHTML = `<img src="${srcToUse}" class="max-w-full max-h-full object-contain">`; 
            } else { 
                document.getElementById('mediaContent').innerHTML = `<video controls class="max-w-full max-h-full rounded-lg" src="${tempUrlFull || ''}"><p class="text-white">Video cần tải về để xem.</p></video>`; 
            }
        }

        document.getElementById('btnDownloadCurrentMedia').addEventListener('click', (e) => {
            if(curMediaIdForDownload) window.downloadItem(curMediaIdForDownload, 'file', curMediaNameForDownload, e);
        });

        function closeMedia() { 
            document.getElementById('mediaViewer').classList.add('hidden'); 
            document.getElementById('mediaViewer').classList.remove('flex'); 
            document.getElementById('mediaContent').innerHTML = ''; 
            curMediaIdForDownload = null;
        }

        function closeFab() { fabMenu.classList.add('hidden'); fabMenu.classList.remove('flex'); fabIcon.style.transform = 'rotate(0deg)'; fabIcon.classList.add('fa-plus'); fabIcon.classList.remove('fa-times'); }
        
        const state = { images: [], savedWatermarks: [], activeEditTarget: 'text', colorMode: 'color', activeElementId: null, layerOrder: [] };
const createText = (val, id = generateId()) => ({ id, val, x: 50, y: 50, scale: 30, rotation: 0, color: '#ffffff', stroke: 'transparent', fontFamily: 'Roboto', fontWeight: 'normal', fontStyle: 'normal', textShadow: 'none', opacity: 100 });
        const createWm = (src, id = generateId()) => ({ id, src, x: 50, y: 50, scale: 30, rotation: 0, opacity: 100 });
        const grid = document.getElementById('image-grid');
        const mainContainerOverlay = document.getElementById('main-container-overlay');
        const overlayContainer = document.getElementById('watermark-overlay-container');
        
        function generateId() { return Math.random().toString(36).substr(2, 9); }
        function getTargetImages() { const selected = state.images.filter(img => img.selected); return selected.length > 0 ? selected : state.images; }
        
        function cleanUpLayerOrder() { state.layerOrder = state.layerOrder.filter(layer => { return state.images.some(img => { if (layer.type === 'text') return img.texts.some(t => t.id === layer.id); return img.wms.some(w => w.id === layer.id); }); }); }

        document.getElementById('btn-open-design').addEventListener('click', () => {
            const driveImages = currentDriveItems
                .filter(item => item.type !== 'folder' && item.mimeType && item.mimeType.includes('image'))
                .map(item => ({
                    url: item.tempUrl ? item.tempUrl : `https://drive.google.com/thumbnail?id=${item.id}&sz=w2000`
                }));

            if(driveImages.length === 0) {
                closeFab();
                showToast("Không tìm thấy ảnh nào!", true);
                return;
            }
            state.images = []; state.layerOrder = []; state.activeElementId = null;
            driveImages.forEach(img => {
                state.images.push({ 
                    id: generateId(), src: img.url, ratio: 'auto', panX: 50, panY: 50, selected: false, customName: '', texts: [], wms: [],
                    filterBrightness: 100, filterDarkness: 0, filterSharpness: 0, filterContrast: 100, filterSaturate: 100, filterRotate: 0 
                });
            });
            renderImages();
            overlayContainer.style.display = 'flex';
        });

        document.getElementById('btn-close-design').addEventListener('click', () => { overlayContainer.style.display = 'none'; });

        async function processAllEditedImages() {
            showToast('Đang xử lý xuất ảnh...'); state.activeElementId = null; renderImages(); renderLayers();
            const outputImages = [];
            for (let i = 0; i < state.images.length; i++) {
                const imgData = state.images[i]; const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
                const baseImg = await loadImage(imgData.src);
                let sX = 0, sY = 0, sWidth = baseImg.width, sHeight = baseImg.height;
                if(imgData.ratio !== 'auto') {
                    let targetRatio = imgData.ratio === '1/1' ? 1 : (imgData.ratio === '4/5' ? 4/5 : 1.91/1);
                    const currentRatio = baseImg.width / baseImg.height;
                    if(currentRatio > targetRatio) { sHeight = baseImg.height; sWidth = baseImg.height * targetRatio; sX = (imgData.panX / 100) * (baseImg.width - sWidth); } 
                    else { sWidth = baseImg.width; sHeight = baseImg.width / targetRatio; sY = (imgData.panY / 100) * (baseImg.height - sHeight); }
                }
                canvas.width = sWidth; canvas.height = sHeight;
                
                ctx.save();
                let calcBright = imgData.filterBrightness - imgData.filterDarkness;
                let calcCont = imgData.filterContrast + imgData.filterSharpness / 2;
                ctx.filter = `brightness(${calcBright}%) contrast(${calcCont}%) saturate(${imgData.filterSaturate}%)`;
                
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(imgData.filterRotate * Math.PI / 180);
                let scaleFit = 1 + Math.abs(imgData.filterRotate)/90 * 0.4;
                ctx.scale(scaleFit, scaleFit);
                
                ctx.drawImage(baseImg, sX, sY, sWidth, sHeight, -canvas.width/2, -canvas.height/2, canvas.width, canvas.height);
                ctx.restore();
                
                for (let layer of state.layerOrder) {
                    if (layer.type === 'wm') {
                        const wmItem = imgData.wms.find(w => w.id === layer.id);
                        if (wmItem) {
                            const wmImg = await loadImage(wmItem.src); const drawWidth = (canvas.width * wmItem.scale) / 100; const drawHeight = (wmImg.height / wmImg.width) * drawWidth;
                            ctx.save(); ctx.translate((canvas.width * wmItem.x) / 100, (canvas.height * wmItem.y) / 100); ctx.rotate((wmItem.rotation || 0) * Math.PI / 180); ctx.globalAlpha = wmItem.opacity / 100;
                            ctx.drawImage(wmImg, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight); ctx.restore();
                        }
                    } else if (layer.type === 'text') {
                        const tItem = imgData.texts.find(t => t.id === layer.id);
                        if (tItem) {
                            const fontSize = (canvas.width * tItem.scale) / 500; 
                            ctx.save(); ctx.translate((canvas.width * tItem.x) / 100, (canvas.height * tItem.y) / 100); ctx.rotate((tItem.rotation || 0) * Math.PI / 180);
                            ctx.font = `${tItem.fontStyle} ${tItem.fontWeight} ${fontSize}px '${tItem.fontFamily}'`; ctx.fillStyle = tItem.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            if (tItem.textShadow !== 'none') { ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 4; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; }
                            ctx.globalAlpha = tItem.opacity / 100;
                            if (tItem.stroke !== 'transparent') { ctx.strokeStyle = tItem.stroke; ctx.lineWidth = fontSize / 10; ctx.lineJoin = "round"; ctx.strokeText(tItem.val, 0, 0); }
                            ctx.shadowColor = "transparent"; ctx.fillText(tItem.val, 0, 0); ctx.restore();
                        }
                    }
                }
                const base64Data = canvas.toDataURL('image/jpeg', 1.0).replace(/^data:image\/jpeg;base64,/, '');
                const randomName = 'IMG_' + Math.random().toString(36).substring(2, 8).toUpperCase();
                const rawName = imgData.customName ? imgData.customName.trim() : randomName;
                const cleanName = rawName.replace(/[\/\\?%*:|"<>]/g, '');
                outputImages.push({ fileName: `${cleanName}.jpg`, data: base64Data });
            }
            return outputImages;
        }

        document.getElementById('save-all-btn').addEventListener('click', () => {
            if(state.images.length === 0) return showToast('Không có ảnh để lưu.', true);
            document.getElementById('save-options-modal').classList.remove('hidden'); document.getElementById('save-options-modal').classList.add('flex');
        });

        document.getElementById('btn-save-local').addEventListener('click', async () => {
            document.getElementById('save-options-modal').classList.add('hidden');
            try {
                const editedImages = await processAllEditedImages();
                const safeFolderName = "VinhLoc_Design";
                for (let i = 0; i < editedImages.length; i++) {
                    const img = editedImages[i];
                    const link = document.createElement('a');
                    link.href = 'data:image/jpeg;base64,' + img.data; 
                    link.download = `${safeFolderName}_${img.fileName}`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    await new Promise(r => setTimeout(r, 400));
                }
                showToast(`<i class="fas fa-check-circle mr-2"></i> Đã tải lần lượt ${editedImages.length} ảnh về máy!`);
            } catch (error) { showToast('Lỗi tải ảnh: ' + error.message, true); }
        });

        document.getElementById('btn-save-drive').addEventListener('click', async () => {
            document.getElementById('save-options-modal').classList.add('hidden'); document.getElementById('save-options-modal').classList.remove('flex');
            try {
                const editedImages = await processAllEditedImages(); 
                if (editedImages.length === 0) return;
                showToast('<i class="fas fa-spinner fa-spin mr-2"></i> Đang tải lên Drive...');
                
                let newFolderId = null;
                let existingFolder = currentDriveItems.find(i => i.name === "ĐÃ CHỈNH SỬA" && i.type === "folder");
                
                if (existingFolder) {
                    newFolderId = existingFolder.id;
                } else {
                    let createRes = await apiCall('createFolder', { name: "ĐÃ CHỈNH SỬA" });
                    newFolderId = createRes.folderId || createRes.id;
                    if (newFolderId) {
                        currentDriveItems.unshift({ id: newFolderId, name: "ĐÃ CHỈNH SỬA", type: "folder" });
                        folderDataCache[currentFolderId] = currentDriveItems; 
                        renderItems(currentDriveItems);
                    }
                }
                if (!newFolderId) throw new Error("Không thể truy cập thư mục lưu trữ.");
                let successCount = 0;
                for (let i = 0; i < editedImages.length; i++) {
                    let img = editedImages[i];
                    let uploadRes = await window.apiCall('upload', { folderId: newFolderId, filename: img.fileName, mimeType: 'image/jpeg', data: img.data });
                    if (uploadRes && uploadRes.success) successCount++;
                }
                showToast(`<i class="fas fa-check-circle mr-2"></i> Đã lưu thành công ${successCount}/${editedImages.length} ảnh vào "ĐÃ CHỈNH SỬA"!`);
            } catch (error) { showToast('Lỗi lưu Drive: ' + error.message, true); }
        });

        let scrollInterval = null;
        function startScroll(dir) { 
            if(scrollInterval) clearInterval(scrollInterval); 
            scrollInterval = setInterval(() => {
                mainContainerOverlay.scrollTop += dir * 25; 
            }, 16); 
        }
        function stopScroll() { if(scrollInterval) { clearInterval(scrollInterval); scrollInterval = null; } }
        ['touchstart', 'mousedown'].forEach(evt => { 
            document.getElementById('scroll-up-btn').addEventListener(evt, (e) => { e.preventDefault(); startScroll(-1); }); 
            document.getElementById('scroll-down-btn').addEventListener(evt, (e) => { e.preventDefault(); startScroll(1); }); 
        });
        ['touchend', 'mouseup', 'mouseleave'].forEach(evt => { 
            document.getElementById('scroll-up-btn').addEventListener(evt, stopScroll); 
            document.getElementById('scroll-down-btn').addEventListener(evt, stopScroll); 
        });

        function renderLayers() {
            const menu = document.getElementById('layer-menu'); menu.innerHTML = '<div class="layer-title" style="padding:15px; font-weight:bold; border-bottom:1px solid #f3f4f6;">Z-Index</div>';
            if(state.layerOrder.length === 0) { menu.innerHTML += '<div style="padding:15px; font-size:13px; text-align:center;">Trống</div>'; return; }
            [...state.layerOrder].reverse().forEach((layer, revIdx) => {
                const realIndex = state.layerOrder.length - 1 - revIdx;
                const itemDiv = document.createElement('div'); itemDiv.className = `menu-item ${state.activeElementId === layer.id ? 'bg-gray-100' : ''}`; itemDiv.draggable = true; itemDiv.style.display = 'flex'; itemDiv.style.justifyContent = 'space-between';
                let cHTML = layer.type === 'text' ? `<i class="fa-solid fa-font mr-2 text-red-500"></i> <span>Chữ</span>` : `<i class="fa-solid fa-image mr-2 text-blue-500"></i> <span>Ảnh</span>`;
                itemDiv.innerHTML = `<div class="layer-info flex items-center flex-1" onclick="window.selectLayer('${layer.id}', '${layer.type}')">${cHTML}</div>
                    <div class="layer-controls flex gap-3 text-gray-400"><i class="fa-solid fa-chevron-up hover:text-blue-500" onclick="window.moveLayer(${realIndex}, 1, event)"></i><i class="fa-solid fa-chevron-down hover:text-blue-500" onclick="window.moveLayer(${realIndex}, -1, event)"></i><i class="fa-solid fa-trash hover:text-red-500" onclick="window.deleteLayer('${layer.id}', '${layer.type}', event)"></i></div>`;
                itemDiv.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', realIndex); });
                itemDiv.addEventListener('dragover', e => { e.preventDefault(); itemDiv.style.background = '#f5f5f5'; });
                itemDiv.addEventListener('dragleave', e => itemDiv.style.background = '');
                itemDiv.addEventListener('drop', e => { e.preventDefault(); const fromIdx = parseInt(e.dataTransfer.getData('text/plain')); if(fromIdx !== realIndex){ const [mv] = state.layerOrder.splice(fromIdx, 1); state.layerOrder.splice(realIndex, 0, mv); renderImages(); renderLayers(); } });
                menu.appendChild(itemDiv);
            });
        }

        window.selectLayer = function(id, type) { state.activeElementId = id; state.activeEditTarget = type; document.querySelector(`input[name="adjust-target"][value="${type}"]`).checked = true; renderImages(); renderLayers(); syncSliders(); const ap = document.querySelector('.nav-item[data-panel="panel-adjust"]'); if(!ap.classList.contains('active')) ap.click(); };
        window.moveLayer = function(idx, dir, e) { e.stopPropagation(); const nIdx = idx + dir; if(nIdx < 0 || nIdx >= state.layerOrder.length) return; const t = state.layerOrder[idx]; state.layerOrder[idx] = state.layerOrder[nIdx]; state.layerOrder[nIdx] = t; renderImages(); renderLayers(); };
        window.deleteLayer = function(id, type, e) { if(e) e.stopPropagation(); getTargetImages().forEach(img => { if(type === 'text') img.texts = img.texts.filter(t => t.id !== id); else img.wms = img.wms.filter(w => w.id !== id); }); cleanUpLayerOrder(); if (state.activeElementId === id) state.activeElementId = null; renderImages(); renderLayers(); };
        
        document.getElementById('menu-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('dropdown-menu').classList.toggle('show'); document.getElementById('layer-menu').classList.remove('show'); });
        document.getElementById('layer-btn').addEventListener('click', (e) => { e.stopPropagation(); renderLayers(); document.getElementById('layer-menu').classList.toggle('show'); document.getElementById('dropdown-menu').classList.remove('show'); });
        
        window.updateProp = function(key, val) { getTargetImages().forEach(img => { (state.activeEditTarget === 'text' ? img.texts : img.wms).forEach(item => { if(state.activeElementId){ if(item.id === state.activeElementId) item[key] = val; } else item[key] = val; }); }); renderImages(); };
        window.applyRatio = function(r) { getTargetImages().forEach(img => img.ratio = r); renderImages(); };
        window.toggleStyle = function(p, v1, v2) { let tg = getTargetImages(); if(tg.length===0) return; let cur = v1; if(tg[0].texts.length>0) { let t = tg[0].texts.find(x=>x.id===state.activeElementId) || tg[0].texts[tg[0].texts.length-1]; if(t) cur = t[p]; } window.updateProp(p, cur===v1?v2:v1); };
        
        window.updateFilter = function(prop, val) {
            getTargetImages().forEach(img => {
                img[prop] = parseFloat(val);
            });
            renderImages();
        };

        function syncSliders() { 
            const tg=getTargetImages(); 
            if(tg.length>0){ 
                const items=state.activeEditTarget==='text'?tg[0].texts:tg[0].wms; 
                let ref=items.find(i=>i.id===state.activeElementId)||items[items.length-1]; 
                if(ref){ 
                    document.getElementById('slider-scale').value=ref.scale; 
                    document.getElementById('slider-x').value=ref.x; 
                    document.getElementById('slider-y').value=ref.y; 
                    document.getElementById('slider-opacity').value=ref.opacity; 
                } 
                const imgRef = tg[0];
                document.getElementById('slider-filter-brightness').value = imgRef.filterBrightness;
                document.getElementById('slider-filter-darkness').value = imgRef.filterDarkness;
                document.getElementById('slider-filter-sharpness').value = imgRef.filterSharpness;
                document.getElementById('slider-filter-contrast').value = imgRef.filterContrast;
                document.getElementById('slider-filter-saturate').value = imgRef.filterSaturate;
                document.getElementById('slider-filter-rotate').value = imgRef.filterRotate;
            } 
        }

        document.querySelectorAll('input[name="adjust-target"]').forEach(r => r.addEventListener('change', e => { state.activeEditTarget=e.target.value; state.activeElementId=null; syncSliders(); renderLayers(); }));
        
        // KÍCH HOẠT SỰ KIỆN CLICK CHO CÁC TAB BỘ LỌC CHỈNH ẢNH
        document.querySelectorAll('#filter-sub-tabs .sub-tab-btn').forEach((btn, idx) => { 
            btn.addEventListener('click', () => { 
                document.querySelectorAll('#filter-sub-tabs .sub-tab-btn').forEach(b => b.classList.remove('active')); 
                btn.classList.add('active'); 
                document.querySelectorAll('#filter-sliders .slider-row').forEach((d, i) => {
                    d.style.display = i === idx ? 'flex' : 'none';
                }); 
            }); 
        });

        ['brightness', 'darkness', 'sharpness', 'contrast', 'saturate', 'rotate'].forEach(p => {
            const slider = document.getElementById(`slider-filter-${p}`);
            if(slider) {
                slider.addEventListener('input', e => {
                    const stateProp = 'filter' + p.charAt(0).toUpperCase() + p.slice(1);
                    window.updateFilter(stateProp, e.target.value);
                });
            }
        });

        document.querySelectorAll('#adjust-sub-tabs .sub-tab-btn').forEach((btn, idx) => { btn.addEventListener('click', () => { document.querySelectorAll('#adjust-sub-tabs .sub-tab-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); document.querySelectorAll('#adjust-sliders .slider-row').forEach((d,i)=>d.style.display=i===idx?'flex':'none'); }); });
        
        ['scale','x','y','opacity'].forEach(p => document.getElementById(`slider-${p}`).addEventListener('input', e => window.updateProp(p, e.target.value)));

        const colorContainer = document.getElementById('color-picker-container');
        colorContainer.innerHTML = '';
        
        const pickerLabel = document.createElement('label');
        pickerLabel.className = 'color-dot';
        pickerLabel.style.background = 'linear-gradient(45deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff)';
        pickerLabel.style.position = 'relative';
        pickerLabel.style.display = 'block';
        pickerLabel.innerHTML = '<input type="color" style="opacity:0; position:absolute; inset:0; width:100%; height:100%; cursor:pointer;" onchange="window.updateProp(state.colorMode, this.value)">';
        colorContainer.appendChild(pickerLabel);
        
        const colors40 = [
            '#ffffff','#f8f9fa','#e5e7eb','#9ca3af','#4b5563','#000000',
            '#fecaca','#ef4444','#b91c1c','#7f1d1d',
            '#fbcfe8','#ec4899','#be185d','#831843',
            '#e9d5ff','#d946ef','#a21caf','#701a75',
            '#bfdbfe','#3b82f6','#1d4ed8','#1e3a8a',
            '#a7f3d0','#10b981','#047857','#064e3b',
            '#fef08a','#f59e0b','#b45309','#78350f',
            '#fed7aa','#f97316','#c2410c','#7c2d12',
            '#e5e5e5','#a3a3a3','#525252','#262626',
            '#fbbf24','#d97706'
        ];
        colors40.forEach(c => { 
            const d=document.createElement('div'); d.className='color-dot'; d.style.background=c; d.addEventListener('click',()=>window.updateProp(state.colorMode,c)); colorContainer.appendChild(d); 
        });

        document.querySelectorAll('#text-sub-tabs .sub-tab-btn').forEach(btn => { btn.addEventListener('click', () => { document.querySelectorAll('#text-sub-tabs .sub-tab-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); const tg=btn.dataset.target; document.getElementById('color-picker-wrapper').style.display=(tg==='color'||tg==='stroke')?'block':'none'; document.getElementById('font-picker-wrapper').style.display=tg==='font'?'block':'none'; document.getElementById('style-picker-container').style.display=tg==='style'?'flex':'none'; if(tg==='color') state.colorMode='color'; if(tg==='stroke') state.colorMode='stroke'; }); });

        document.getElementById('btn-open-input').addEventListener('click', () => { if(state.activeElementId && state.activeEditTarget==='text'){ const t=getTargetImages()[0]?.texts.find(x=>x.id===state.activeElementId); document.getElementById('main-text-input').value=t?t.val:''; } else document.getElementById('main-text-input').value=''; document.getElementById('input-overlay').style.display='flex'; document.getElementById('main-text-input').focus(); });
        document.getElementById('btn-close-input').addEventListener('click', () => document.getElementById('input-overlay').style.display='none');
        document.getElementById('btn-apply-input').addEventListener('click', () => { const v=document.getElementById('main-text-input').value.trim(); if(!v) return; if(state.activeElementId && state.activeEditTarget==='text') window.updateProp('val', v); else { const sI=generateId(); getTargetImages().forEach(i=>i.texts.push(createText(v,sI))); state.layerOrder.push({id:sI,type:'text'}); state.activeElementId=sI; state.activeEditTarget='text'; document.querySelector(`input[name="adjust-target"][value="text"]`).checked=true; } renderImages(); renderLayers(); syncSliders(); document.getElementById('input-overlay').style.display='none'; });

        document.getElementById('btn-delete-text').addEventListener('click', () => { getTargetImages().forEach(i=>i.texts=[]); cleanUpLayerOrder(); state.activeElementId=null; renderImages(); renderLayers(); });
        document.getElementById('btn-delete-wm').addEventListener('click', () => { getTargetImages().forEach(i=>i.wms=[]); cleanUpLayerOrder(); state.activeElementId=null; renderImages(); renderLayers(); });

        document.querySelectorAll('#rename-sub-tabs .sub-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#rename-sub-tabs .sub-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const target = btn.dataset.target;
                if(target === 'rename-batch') {
                    document.getElementById('rename-batch').style.display = 'flex';
                    document.getElementById('rename-individual').style.display = 'none';
                } else {
                    document.getElementById('rename-batch').style.display = 'none';
                    document.getElementById('rename-individual').style.display = 'flex';
                    window.renderRenameList();
                }
            });
        });

        window.renderRenameList = function() {
            const cont = document.getElementById('rename-list-container'); cont.innerHTML = '';
            const tg = getTargetImages(); if(tg.length===0) { cont.innerHTML = '<div style="text-align:center;color:#777;margin-top:20px; font-style:italic;">Chưa chọn ảnh</div>'; return; }
            tg.forEach(img => {
                const d = document.createElement('div'); d.className = 'rename-item';
                d.innerHTML = `<img src="${img.src}"><input type="text" value="${img.customName||''}" placeholder="Nhập tên mới...">`;
                d.querySelector('input').addEventListener('input', e => img.customName = e.target.value); cont.appendChild(d);
            });
        };
        
        document.getElementById('btn-apply-batch-name').addEventListener('click', function() { 
            const bn = document.getElementById('batch-name-input').value.trim(); if(!bn) return; 
            getTargetImages().forEach((img, idx) => img.customName = `${bn}_${idx+1}`); 
            window.renderRenameList(); 
            const originalHTML = this.innerHTML; this.innerHTML = '<i class="fa-solid fa-check"></i> Đã áp dụng'; this.classList.replace('btn-blue', 'bg-green-600');
            setTimeout(() => { this.innerHTML = originalHTML; this.classList.replace('bg-green-600', 'btn-blue'); }, 1500);
        });

        function renderImages() {
            grid.innerHTML = '';
            state.images.forEach(imgData => {
                const card = document.createElement('div'); card.className = `image-card ${imgData.selected ? 'selected' : ''}`; card.dataset.id = imgData.id; card.style.aspectRatio = imgData.ratio !== 'auto' ? imgData.ratio : 'auto';
                card.innerHTML = `<i class="fa-solid fa-circle-check check-icon"></i><i class="fa-solid fa-thumbtack pin-icon" onclick="event.stopPropagation(); const idx=state.images.findIndex(i=>i.id==='${imgData.id}'); if(idx>0){ const [it]=state.images.splice(idx,1); state.images.unshift(it); renderImages(); }"></i>`;
                
                const img = document.createElement('img'); img.className = 'base-img'; img.src = imgData.src;
                
                let calcBright = imgData.filterBrightness - imgData.filterDarkness;
                let calcCont = imgData.filterContrast + imgData.filterSharpness / 2;
                img.style.filter = `brightness(${calcBright}%) contrast(${calcCont}%) saturate(${imgData.filterSaturate}%)`;
                
                let scaleFit = 1 + Math.abs(imgData.filterRotate)/90 * 0.4;
                img.style.transform = `rotate(${imgData.filterRotate}deg) scale(${scaleFit})`;
                
                if(imgData.ratio !== 'auto') {
                    img.style.height = '100%'; img.style.objectFit = 'cover'; img.style.objectPosition = `${imgData.panX}% ${imgData.panY}%`;
                    let isP = false, sX, sY, iX, iY;
                    img.addEventListener('touchstart', e => { isP=false; sX=e.touches[0].clientX; sY=e.touches[0].clientY; iX=imgData.panX; iY=imgData.panY; }, {passive:true});
                    img.addEventListener('touchmove', e => { const dx=e.touches[0].clientX-sX; const dy=e.touches[0].clientY-sY; if(Math.abs(dx)>5||Math.abs(dy)>5) isP=true; const pR=img.parentElement.getBoundingClientRect(); imgData.panX=Math.max(0,Math.min(100,iX-(dx/pR.width)*100)); imgData.panY=Math.max(0,Math.min(100,iY-(dy/pR.height)*100)); img.style.objectPosition=`${imgData.panX}% ${imgData.panY}%`; }, {passive:true});
                    img.addEventListener('touchend', e => { if(isP) e.stopPropagation(); });
                }
                card.appendChild(img);
                
                state.layerOrder.forEach(layer => {
                    if(layer.type === 'wm') {
                        const wI = imgData.wms.find(w=>w.id===layer.id); if(!wI) return;
                        const wDiv = document.createElement('div'); wDiv.className = `overlay-item ${state.activeElementId===wI.id?'active':''}`;
                        wDiv.style.left=`${wI.x}%`; wDiv.style.top=`${wI.y}%`; wDiv.style.width=`${wI.scale}%`; wDiv.style.opacity=wI.opacity/100; wDiv.style.transform=`translate(-50%,-50%) rotate(${wI.rotation||0}deg)`;
                        wDiv.innerHTML = `<img class="overlay-img" src="${wI.src}"><div class="ctrl-btn ctrl-delete"><i class="fa-solid fa-times"></i></div><div class="ctrl-btn ctrl-scale-rotate"><i class="fa-solid fa-arrows-up-down-left-right"></i></div>`;
                        setupTouchDrag(wDiv, imgData, wI, 'wm'); card.appendChild(wDiv);
                    } else {
                        const tI = imgData.texts.find(t=>t.id===layer.id); if(!tI) return;
                        const tDiv = document.createElement('div'); tDiv.className = `overlay-item text-layer ${state.activeElementId===tI.id?'active':''}`;
                        tDiv.style.left=`${tI.x}%`; tDiv.style.top=`${tI.y}%`; tDiv.style.fontSize=`${tI.scale/5}cqw`; tDiv.style.color=tI.color; tDiv.style.opacity=tI.opacity/100; tDiv.style.transform=`translate(-50%,-50%) rotate(${tI.rotation||0}deg)`;
                        tDiv.style.fontFamily=tI.fontFamily; tDiv.style.fontWeight=tI.fontWeight; tDiv.style.fontStyle=tI.fontStyle; tDiv.style.textShadow=tI.textShadow; tDiv.style.webkitTextStroke=tI.stroke!=='transparent'?`4px ${tI.stroke}`:'0px transparent';
                        tDiv.innerHTML = `<span>${tI.val}</span><div class="ctrl-btn ctrl-delete"><i class="fa-solid fa-times"></i></div><div class="ctrl-btn ctrl-scale-rotate"><i class="fa-solid fa-arrows-up-down-left-right"></i></div>`;
                        setupTouchDrag(tDiv, imgData, tI, 'text'); card.appendChild(tDiv);
                    }
                });

                card.addEventListener('click', e => { if(e.target.closest('.overlay-item')||e.target.closest('.pin-icon')) return; imgData.selected=!imgData.selected; state.activeElementId=null; renderImages(); renderLayers(); if(document.getElementById('panel-rename').classList.contains('active')) window.renderRenameList(); });
                grid.appendChild(card);
            });
        }

        function setupTouchDrag(el, iD, itD, ty) {
            let isD=false, isS=false, sX, sY, iX, iY, iSc, iR, cX, cY, sA;
            el.addEventListener('touchstart', e => {
                state.activeElementId=itD.id; state.activeEditTarget=ty; document.querySelector(`input[name="adjust-target"][value="${ty}"]`).checked=true;
                if(e.target.closest('.ctrl-delete')){ window.deleteLayer(itD.id, ty, e); return; }
                const t=e.touches[0];
                if(e.target.closest('.ctrl-scale-rotate')){
                    isS=true; const r=el.getBoundingClientRect(); cX=r.left+r.width/2; cY=r.top+r.height/2; iSc=itD.scale; iR=itD.rotation||0; sX=t.clientX; sY=t.clientY; sA=Math.atan2(sY-cY,sX-cX);
                } else { isD=true; sX=t.clientX; sY=t.clientY; iX=itD.x; iY=itD.y; }
                document.querySelectorAll('.overlay-item').forEach(e=>e.classList.remove('active')); el.classList.add('active'); syncSliders(); renderLayers();
            }, {passive:true});
            el.addEventListener('touchmove', e => {
                if(!isD && !isS) return; e.preventDefault(); const t=e.touches[0];
                if(isD){ const pR=el.parentElement.getBoundingClientRect(); itD.x=iX+((t.clientX-sX)/pR.width)*100; itD.y=iY+((t.clientY-sY)/pR.height)*100; el.style.left=`${itD.x}%`; el.style.top=`${itD.y}%`; document.getElementById('slider-x').value=itD.x; document.getElementById('slider-y').value=itD.y; }
                else if(isS){ const dist=Math.sqrt(Math.pow(t.clientX-cX,2)+Math.pow(t.clientY-cY,2)); itD.scale=iSc*(dist/(Math.sqrt(Math.pow(sX-cX,2)+Math.pow(sY-cY,2))||1)); itD.rotation=iR+((Math.atan2(t.clientY-cY,t.clientX-cX)-sA)*(180/Math.PI)); el.style.transform=`translate(-50%,-50%) rotate(${itD.rotation}deg)`; if(ty==='text') el.style.fontSize=`${itD.scale/5}cqw`; else el.style.width=`${itD.scale}%`; document.getElementById('slider-scale').value=itD.scale; }
            });
            el.addEventListener('touchend', () => { isD=false; isS=false; const tg=getTargetImages(); if(tg.length>1||(!iD.selected && tg.length===state.images.length)){ tg.forEach(i=>{ const match=(ty==='text'?i.texts:i.wms).find(x=>x.id===state.activeElementId); if(match&&match!==itD){ match.x=itD.x; match.y=itD.y; match.scale=itD.scale; match.rotation=itD.rotation; } }); renderImages(); } });
        }

        let aSel=false;
        document.getElementById('select-all-btn').addEventListener('click', e => { aSel=!aSel; state.images.forEach(i=>i.selected=aSel); e.target.innerHTML=aSel?'<i class="fa-solid fa-check-double mr-2 text-blue-500"></i> Bỏ chọn':'<i class="fa-solid fa-check-double mr-2 text-blue-500"></i> Chọn tất cả'; renderImages(); if(document.getElementById('panel-rename').classList.contains('active')) window.renderRenameList(); });
        document.getElementById('delete-selected-btn').addEventListener('click', () => { state.images=state.images.filter(i=>!i.selected); renderImages(); if(document.getElementById('panel-rename').classList.contains('active')) window.renderRenameList(); });

        document.querySelectorAll('.nav-item').forEach(item => { 
            item.addEventListener('click', () => { 
                const tP = document.getElementById(item.dataset.panel); 
                if(item.classList.contains('active')){ 
                    item.classList.remove('active'); tP.classList.remove('active'); 
                } else { 
                    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active')); 
                    document.querySelectorAll('.control-panel').forEach(p=>p.classList.remove('active')); 
                    item.classList.add('active'); tP.classList.add('active'); 
                    if(item.dataset.panel==='panel-rename') {
                        if(document.getElementById('rename-individual').style.display === 'flex') {
                            window.renderRenameList();
                        }
                    }
                } 
            }); 
        });

        // NÚT LƯU CHỮ LÊN THƯ VIỆN DRIVE
        document.getElementById('btn-save-text-wm').addEventListener('click', async () => {
            const tg=getTargetImages(); if(tg.length===0||tg[0].texts.length===0) return showToast('Không có chữ.', true);
            let t=tg[0].texts.find(x=>x.id===state.activeElementId)||tg[0].texts[tg[0].texts.length-1];
            
            const c=document.createElement('canvas'); const cx=c.getContext('2d'); c.width=800; c.height=200;
            cx.font=`${t.fontStyle} ${t.fontWeight} 60px '${t.fontFamily}'`; cx.fillStyle=t.color; cx.textAlign='center'; cx.textBaseline='middle';
            if(t.textShadow!=='none'){ cx.shadowColor="rgba(0,0,0,0.8)"; cx.shadowBlur=4; cx.shadowOffsetX=2; cx.shadowOffsetY=2; }
            if(t.stroke!=='transparent'){ cx.strokeStyle=t.stroke; cx.lineWidth=6; cx.lineJoin="round"; cx.strokeText(t.val,400,100); }
            cx.shadowColor="transparent"; cx.fillText(t.val,400,100);
            
            const base64Data = c.toDataURL('image/png').split(',')[1];
            showToast('<i class="fas fa-spinner fa-spin mr-2"></i> Đang lưu chữ lên Drive...');
            
            let res = await bgApiCall('upload', { folderId: WM_FOLDER_ID, filename: 'TEXT_WM_' + Date.now() + '.png', mimeType: 'image/png', data: base64Data });
            if(res && res.success) {
                showToast('<i class="fas fa-check mr-2"></i> Đã lưu thành Watermark trên Drive');
                const srcUrl = `https://drive.google.com/thumbnail?id=${res.id}&sz=w800`;
                state.savedWatermarks.unshift({id: res.id, src: srcUrl}); 
                if(wmP.style.display === 'flex') renderWMLibrary();
            } else {
                showToast('Lỗi lưu Watermark', true);
            }
        });

        const wmP = document.getElementById('watermark-popup');
        let isFetchingWM = false;
        
        // MỞ THƯ VIỆN LẤY TRỰC TIẾP TỪ DRIVE KHÔNG QUA LOCALSTORAGE
        document.getElementById('btn-open-wm-library').addEventListener('click', async () => { 
            wmP.style.display='flex'; 
            
            if (state.savedWatermarks.length === 0) {
                document.getElementById('wm-library-grid').innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 30px;"><div class="loader mx-auto border-blue-500 mb-2"></div><span class="text-sm text-gray-500">Đang tải Thư viện Logo từ Drive...</span></div>';
            } else {
                renderWMLibrary();
            }
            
            if (isFetchingWM) return;
            isFetchingWM = true;
            
            try {
                let res = await apiCall('list', { folderId: WM_FOLDER_ID }); // Dùng apiCall để có Loading
                if(res && res.success) {
                    const files = res.data.filter(i => i.type === 'file');
                    const newWms = files.map(f => ({
                        id: f.id,
                        src: `https://drive.google.com/thumbnail?id=${f.id}&sz=w800`
                    }));
                    
                    state.savedWatermarks = newWms;
                    if(wmP.style.display === 'flex') renderWMLibrary();
                } else {
                    if (state.savedWatermarks.length === 0) {
                        document.getElementById('wm-library-grid').innerHTML = '<div style="grid-column: span 3; text-align: center; color: #ef4444; font-size: 13px; padding: 20px 0;">Thư mục Logo rỗng hoặc lỗi.</div>';
                    }
                }
            } catch(e) {
                console.log("Lỗi đồng bộ thư viện WM ngầm.", e);
            } finally {
                isFetchingWM = false;
            }
        });
        
        document.getElementById('btn-close-wm-popup').addEventListener('click', () => wmP.style.display='none');

        // HIỂN THỊ WATERMARK TỪ RAM (STATE) VÀ FIX LỖI NÚT XÓA BẰNG ID
        function renderWMLibrary() {
            const grid = document.getElementById('wm-library-grid'); 
            grid.innerHTML = '';
            if(state.savedWatermarks.length === 0) {
                grid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: #6b7280; font-size: 13px; padding: 20px 0;">Chưa có logo nào.</div>';
                return;
            }
            state.savedWatermarks.forEach((wm) => {
                const i = document.createElement('div'); i.className = 'wm-item'; 
                i.innerHTML = `<img src="${wm.src}"><div class="wm-delete-btn"><i class="fa-solid fa-times"></i></div>`;
                
                i.querySelector('.wm-delete-btn').addEventListener('click', e => { 
                    e.stopPropagation(); 
                    bgApiCall('delete', { id: wm.id, type: 'file' }).then(res => {
                        if(res && res.success) showToast('<i class="fas fa-trash mr-2"></i> Đã xóa Logo');
                    });
                    
                    // Xóa bằng ID để không bị sai lệch index
                    state.savedWatermarks = state.savedWatermarks.filter(w => w.id !== wm.id); 
                    renderWMLibrary(); 
                });
                
                i.addEventListener('click', () => { 
                    const sI=generateId(); 
                    getTargetImages().forEach(im=>im.wms.push(createWm(wm.src,sI))); 
                    state.layerOrder.push({id:sI,type:'wm'}); 
                    state.activeElementId=sI; 
                    state.activeEditTarget='wm'; 
                    document.querySelector(`input[name="adjust-target"][value="wm"]`).checked=true; 
                    renderImages(); renderLayers(); syncSliders(); 
                    wmP.style.display='none'; 
                });
                grid.appendChild(i);
            });
        }

        // TẢI LOGO TRỰC TIẾP LÊN DRIVE
        (function(){
            const wmBtn = document.getElementById('btn-upload-wm-local');
            if(wmBtn){
                wmBtn.onclick = async function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.style.display = 'none';
                    document.body.appendChild(input);
                    input.addEventListener('change', function(ev) {
                        const f = ev.target.files[0];
                        if(!f) return;
                        showToast('<i class="fas fa-spinner fa-spin mr-2"></i> Đang tải Logo lên Drive...');
                        const r = new FileReader();
                        r.onload = async function(evt){
                            const b64 = evt.target.result;
                            const base64Data = b64.split(',')[1];
                            
                            let res = await bgApiCall('upload', { folderId: WM_FOLDER_ID, filename: f.name || 'WM_Logo.png', mimeType: f.type || 'image/png', data: base64Data });
                            if (res && res.success) {
                                showToast('<i class="fas fa-check mr-2"></i> Đã tải Logo lên Thư viện');
                                const srcUrl = `https://drive.google.com/thumbnail?id=${res.id}&sz=w800`;
                                
                                state.savedWatermarks.unshift({id: res.id, src: srcUrl}); // Đưa lên đầu mảng
                                if(wmP.style.display === 'flex') renderWMLibrary();
                                
                                const sI = generateId();
                                getTargetImages().forEach(i=>{
                                    i.wms.push(createWm(srcUrl,sI));
                                });
                                state.layerOrder.push({ id:sI, type:'wm' });
                                state.activeElementId = sI;
                                state.activeEditTarget = 'wm';
                                document.querySelector(`input[name="adjust-target"][value="wm"]`).checked=true;
                                renderImages();
                                renderLayers();
                                syncSliders();
                            } else {
                                showToast('Lỗi tải lên logo!', true);
                            }
                        };
                        r.readAsDataURL(f);
                        setTimeout(() => input.remove(), 1000);
                    });
                    input.click();
                };
            }
        })();

        function loadImage(src) {
            return new Promise(async (resolve, reject) => {
                if (src.startsWith('data:')) {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error('Lỗi dữ liệu ảnh nội bộ.'));
                    img.src = src;
                    return;
                }
                const urlsToTry = [ src, "https://wsrv.nl/?url=" + encodeURIComponent(src), "https://corsproxy.io/?" + encodeURIComponent(src), "https://api.allorigins.win/raw?url=" + encodeURIComponent(src) ];
                for (let url of urlsToTry) {
                    try {
                        const response = await fetch(url);
                        if (!response.ok) continue; 
                        const blob = await response.blob();
                        const objectUrl = URL.createObjectURL(blob);
                        const img = new Image();
                        img.onload = () => resolve(img);
                        img.onerror = () => reject(new Error('Lỗi chuyển đổi dữ liệu ảnh.'));
                        img.src = objectUrl;
                        return; 
                    } catch (error) { console.warn("Thử tải thất bại với URL:", url); }
                }
                reject(new Error('Lỗi tải ảnh. Vui lòng tải lại trang hoặc kiểm tra kết nối mạng.'));
            });
        }


        // --- BỔ SUNG XỬ LÝ LIÊN KẾT CHIA SẺ KHI MỞ APP LẦN ĐẦU ---
        window.addEventListener('DOMContentLoaded', () => {
            const params = new URLSearchParams(window.location.search);
            const sId = params.get('shareId');
            const sType = params.get('shareType');
            const sName = params.get('shareName');
            const sMime = params.get('mimeType');

            if (sId) {
                // Xóa tham số khỏi thanh địa chỉ để giữ URL sạch, không ảnh hưởng reload sau này
                window.history.replaceState({}, document.title, window.location.pathname);

                if (sType === 'folder') {
                    folderStack = [
                        { id: ROOT_FOLDER_ID, name: "Triển khai", scrollTop: 0 },
                        { id: sId, name: sName || "Thư mục chia sẻ", scrollTop: 0 }
                    ];
                    currentFolderId = sId;
                    localStorage.setItem('appFolderStack', JSON.stringify(folderStack));
                    loadFolder(sId, sName || "Thư mục chia sẻ", false, false);
                    
                } else if (sType === 'file') {
                    // Tải thư mục gốc làm nền, sau đó pop up ảnh/video lên
                    loadFolder(ROOT_FOLDER_ID, "Triển khai", false, false);
                    setTimeout(() => {
                        openMedia(sId, sMime || '', sName || 'File chia sẻ');
                    }, 500); // Đợi load sương sương DOM rồi bật modal
                }
            } else {
                // Tải app bình thường nếu không có link chia sẻ
                const initItem = folderStack[folderStack.length - 1];
                loadFolder(initItem.id, initItem.name, false, false);
            }
        });
