/* 
   ==========================================================================
   PREMIUM EID ALBUM INTERACTION ENGINE
   ========================================================================== 
*/

// ==========================================================================
// 1. INDEXEDDB PERSISTENCE LAYER
// ==========================================================================
const DB_NAME = 'EidAlbumDB';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = function(e) {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'slotId' });
            }
        };
        
        request.onsuccess = function(e) {
            resolve(e.target.result);
        };
        
        request.onerror = function(e) {
            reject('IndexedDB fail to load: ' + e.target.error);
        };
    });
}

async function getPhotoFromDB(slotId) {
    const db = await initDB();
    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(slotId);
        
        request.onsuccess = function() {
            resolve(request.result || null);
        };
        
        request.onerror = function() {
            resolve(null);
        };
    });
}

async function savePhotoToDB(slotId, imgData) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({
            slotId: slotId,
            src: imgData.src,
            filter: imgData.filter,
            caption: imgData.caption
        });
        
        request.onsuccess = function() {
            resolve(true);
        };
        
        request.onerror = function() {
            reject(request.error);
        };
    });
}

async function deletePhotoFromDB(slotId) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(slotId);
        
        request.onsuccess = function() {
            resolve(true);
        };
        
        request.onerror = function() {
            reject(request.error);
        };
    });
}

// ==========================================================================
// 2. CORE APP STATE & SELECTIONS
// ==========================================================================
const state = {
    activeSlotId: null,
    activeSlotType: null,
    currentSelectedImageSrc: null,
    currentSelectedFilter: 'normal',
    particlesEnabled: true
};

// UI Elements
const els = {
    slots: document.querySelectorAll('.photo-slot'),
    poolSlots: document.querySelectorAll('.pool-slot-card'),
    togglePoolBtn: document.getElementById('toggle-pool-btn'),
    poolGridWrapper: document.getElementById('pool-grid-wrapper'),
    modal: document.getElementById('upload-modal'),
    closeModal: document.getElementById('close-modal'),
    cancelUpload: document.getElementById('cancel-upload'),
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('file-input'),
    dropzonePrompt: document.getElementById('dropzone-prompt'),
    previewContainer: document.getElementById('preview-container'),
    previewImg: document.getElementById('modal-preview-img'),
    editorSection: document.getElementById('editor-controls-section'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    captionInput: document.getElementById('caption-input'),
    savePhotoBtn: document.getElementById('save-photo-btn'),
    deletePhotoBtn: document.getElementById('delete-photo-btn'),
    loveNote: document.getElementById('love-note-text'),
    toggleMusic: document.getElementById('toggle-music'),
    toggleParticles: document.getElementById('toggle-particles'),
    ambientAudio: document.getElementById('ambient-audio'),
    canvas: document.getElementById('ambient-canvas')
};

// Default images mapping to maintain aesthetic look on initial load
const DEFAULT_PHOTOS = {
    v1: { src: 'assets/d/1.jpeg', caption: 'أول لقاء لنا 🌸', filter: 'normal' },
    v2: { src: 'assets/d/2.jpeg', caption: 'ضحكتكِ الجميلة 💫', filter: 'normal' },
    v3: { src: 'assets/d/3.jpeg', caption: 'بجواركِ دائماً ❤️', filter: 'normal' },
    v4: { src: 'assets/d/4.jpeg', caption: 'أنتِ كل أعيادي ✨', filter: 'normal' },
    h1: { src: 'assets/d/6.jpeg', caption: 'سعادة مشتركة 🥰', filter: 'normal' },
    h2: { src: 'assets/d/5.jpeg', caption: 'عيدي يكتمل بكِ 🎁', filter: 'normal' },
    h3: { src: 'assets/d/1.jpeg', caption: 'كل عام وأنتِ بقلبي 💖', filter: 'normal' },
    f1: { src: 'assets/9.png', caption: 'بيت أحلامنا الدافئ 🏡', filter: 'normal' },
    f2: { src: 'assets/11.jpeg', caption: 'رحلة تحت النجوم 🌌', filter: 'normal' },
    f3: { src: 'assets/13.jpeg', caption: 'مغامرات جديدة 🎒', filter: 'normal' },
    f4: { src: 'assets/8.jpeg', caption: 'عائلتنا السعيدة 👨‍👩‍👧', filter: 'normal' },
    f5: { src: 'assets/photo3.png', caption: 'بناء ذكريات أكثر 🛠️', filter: 'normal' },
    f6: { src: 'assets/photo5.png', caption: 'تفاصيل جميلة ✨', filter: 'warm' }
};

// ==========================================================================
// 3. MUSIC & UI ATTAINMENT
// ==========================================================================

// Simple Ambient Audio Toggle with autostart workarounds
let isMusicPlaying = false;
els.toggleMusic.addEventListener('click', () => {
    if (!isMusicPlaying) {
        els.ambientAudio.play().then(() => {
            isMusicPlaying = true;
            els.toggleMusic.classList.add('playing');
        }).catch(err => {
            console.log("Audio autoplay prevented. Click again: ", err);
        });
    } else {
        els.ambientAudio.pause();
        isMusicPlaying = false;
        els.toggleMusic.classList.remove('playing');
    }
});

// Editable Greeting Note Persistence
if (localStorage.getItem('eid_love_note')) {
    els.loveNote.innerText = localStorage.getItem('eid_love_note');
}

els.loveNote.addEventListener('input', () => {
    localStorage.setItem('eid_love_note', els.loveNote.innerText);
});

// ==========================================================================
// 4. HIGH-PERFORMANCE CANVAS AMBIENT SYSTEM
// ==========================================================================
const ctx = els.canvas.getContext('2d');
let particlesArray = [];
let animationFrameId = null;

function resizeCanvas() {
    els.canvas.width = window.innerWidth;
    els.canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.x = Math.random() * els.canvas.width;
        this.y = -20 - Math.random() * 50;
        this.size = Math.random() * 12 + 6; // Petal size
        this.speedY = Math.random() * 1.2 + 0.6; // Soft fall
        this.speedX = Math.random() * 0.8 - 0.4;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 2 - 1;
        this.sway = Math.random() * 2;
        this.swaySpeed = Math.random() * 0.02 + 0.005;
        this.type = Math.random() > 0.45 ? 'petal' : 'glow'; // Rose petal or golden spark
        this.opacity = Math.random() * 0.5 + 0.3;
        
        // Colors
        this.colorType = Math.floor(Math.random() * 3); // 3 shades of rose/gold
    }
    
    update() {
        this.y += this.speedY;
        this.x += this.speedX + Math.sin(this.sway) * 0.4;
        this.sway += this.swaySpeed;
        this.rotation += this.rotationSpeed;
        
        // Recycle particles when off screen
        if (this.y > els.canvas.height + 20 || this.x < -20 || this.x > els.canvas.width + 20) {
            this.reset();
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.globalAlpha = this.opacity;
        
        if (this.type === 'petal') {
            // Draw a beautiful custom rose petal
            ctx.beginPath();
            
            // Choose romantic shades
            if (this.colorType === 0) ctx.fillStyle = '#ffb3c1'; // Soft Pink
            else if (this.colorType === 1) ctx.fillStyle = '#ff758f'; // Vibrant Rose
            else ctx.fillStyle = '#ffcad4'; // Champagne Rose
            
            // Drawing petal curve shapes
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(-this.size, -this.size/2, -this.size/2, -this.size);
            ctx.quadraticCurveTo(0, -this.size * 1.2, this.size/2, -this.size);
            ctx.quadraticCurveTo(this.size, -this.size/2, 0, 0);
            ctx.fill();
        } else {
            // Draw glowing gold particle
            let gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size/2);
            gradient.addColorStop(0, 'rgba(255, 223, 137, 1)');
            gradient.addColorStop(0.3, 'rgba(197, 160, 89, 0.8)');
            gradient.addColorStop(1, 'rgba(197, 160, 89, 0)');
            
            ctx.beginPath();
            ctx.fillStyle = gradient;
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

function initParticles() {
    particlesArray = [];
    const count = Math.min(60, Math.floor(window.innerWidth / 20)); // Density based on width
    for (let i = 0; i < count; i++) {
        particlesArray.push(new Particle());
        // Stagger their initial heights so they don't all drop from top at start
        particlesArray[i].y = Math.random() * els.canvas.height;
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    
    if (state.particlesEnabled) {
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
            particlesArray[i].draw();
        }
    }
    animationFrameId = requestAnimationFrame(animateParticles);
}

// Particle system controls toggle
els.toggleParticles.addEventListener('click', () => {
    state.particlesEnabled = !state.particlesEnabled;
    if (state.particlesEnabled) {
        els.toggleParticles.classList.remove('disabled');
        els.toggleParticles.querySelector('i').className = 'fa-solid fa-wand-magic-sparkles';
    } else {
        els.toggleParticles.classList.add('disabled');
        els.toggleParticles.querySelector('i').className = 'fa-solid fa-wand-magic';
        ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    }
});

// Start Particle Engine
initParticles();
animateParticles();

// ==========================================================================
// 5. PHOTO UPLOAD & CAPTION EDIT MODAL LOGIC
// ==========================================================================

// Open Modal on Slot Click (for both normal slots and pool slots)
function bindSlotClick(element) {
    element.addEventListener('click', async () => {
        const slotId = element.getAttribute('data-slot-id');
        const slotType = element.getAttribute('data-slot-type');
        
        state.activeSlotId = slotId;
        state.activeSlotType = slotType;
        
        // Open modal backdrop
        els.modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Lock scrolling
        
        // Reset Modal Editor State
        resetModalEditor();
        
        // Query Database or Fallback to defaults
        const savedData = await getPhotoFromDB(slotId);
        const activePhotoData = savedData || DEFAULT_PHOTOS[slotId];
        
        if (activePhotoData) {
            // Populate Modal Fields
            state.currentSelectedImageSrc = activePhotoData.src;
            els.previewImg.src = activePhotoData.src;
            els.previewContainer.style.display = 'flex';
            els.dropzonePrompt.style.display = 'none';
            els.editorSection.style.display = 'flex';
            
            // Set Caption
            els.captionInput.value = activePhotoData.caption || '';
            
            // Set Filter
            setFilterState(activePhotoData.filter || 'normal');
            
            // Show Delete button if it is a user saved image (or let them delete anyway)
            els.deletePhotoBtn.style.display = 'flex';
        } else {
            // Fresh state for empty uploads
            els.deletePhotoBtn.style.display = 'none';
        }
    });
}

// Bind to film strip slots
els.slots.forEach(bindSlotClick);
// Bind to expandable pool drawer cards
els.poolSlots.forEach(bindSlotClick);

// Close Modal functions
function closeModalWindow() {
    els.modal.classList.remove('active');
    document.body.style.overflow = ''; // Unlock scrolling
    resetModalEditor();
}

els.closeModal.addEventListener('click', closeModalWindow);
els.cancelUpload.addEventListener('click', closeModalWindow);

// Close on backdrop overlay click
els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) {
        closeModalWindow();
    }
});

// Reset editor variables in modal
function resetModalEditor() {
    state.currentSelectedImageSrc = null;
    state.currentSelectedFilter = 'normal';
    els.previewImg.src = '';
    els.previewImg.className = 'preview-img';
    els.previewContainer.style.display = 'none';
    els.dropzonePrompt.style.display = 'flex';
    els.editorSection.style.display = 'none';
    els.captionInput.value = '';
    els.fileInput.value = '';
    
    els.filterBtns.forEach(btn => btn.classList.remove('active'));
    els.filterBtns[0].classList.add('active');
}

// ==========================================================================
// IMAGE LOADING & DRAG AND DROP HANDLERS
// ==========================================================================

// Handle Dropzone Click triggers file selector
els.dropzone.addEventListener('click', (e) => {
    // Prevent double clicking trigger if click is inside the file selector itself
    if (e.target !== els.fileInput) {
        els.fileInput.click();
    }
});

// Handle File Selection
els.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        processImageFile(file);
    }
});

// Drag and drop styles binding
els.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropzone.classList.add('dragover');
});

els.dropzone.addEventListener('dragleave', () => {
    els.dropzone.classList.remove('dragover');
});

els.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        processImageFile(file);
    }
});

// Convert image file to Base64 and feed it to editor
function processImageFile(file) {
    // Validate size limit (IndexedDB easily supports 5-10MB, but let's keep it safe at 8MB)
    if (file.size > 8 * 1024 * 1024) {
        alert('حجم الصورة كبير جداً، يرجى اختيار صورة أصغر من 8 ميجابايت.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const imageSrc = event.target.result;
        state.currentSelectedImageSrc = imageSrc;
        
        // Update Modal UI
        els.previewImg.src = imageSrc;
        els.previewContainer.style.display = 'flex';
        els.dropzonePrompt.style.display = 'none';
        els.editorSection.style.display = 'flex';
        
        // Set thumbnail styles for filter previews
        document.querySelectorAll('.filter-thumb').forEach(thumb => {
            thumb.style.backgroundImage = `url(${imageSrc})`;
        });
        
        // Show delete button
        els.deletePhotoBtn.style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

// ==========================================================================
// FILTERS SELECTOR ENGINE
// ==========================================================================
els.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter');
        setFilterState(filter);
    });
});

function setFilterState(filterName) {
    state.currentSelectedFilter = filterName;
    
    // Active class toggle
    els.filterBtns.forEach(btn => {
        if (btn.getAttribute('data-filter') === filterName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Reset classes
    els.previewImg.className = 'preview-img';
    
    // Apply correct filter class
    if (filterName !== 'normal') {
        els.previewImg.classList.add(`filter-${filterName}`);
    }
}

// ==========================================================================
// SAVE & DELETE CRUD TRIGGER
// ==========================================================================

// Save Photo Modals click
els.savePhotoBtn.addEventListener('click', async () => {
    if (!state.currentSelectedImageSrc) {
        alert('الرجاء اختيار صورة أولاً.');
        return;
    }
    
    const slotId = state.activeSlotId;
    const photoData = {
        src: state.currentSelectedImageSrc,
        filter: state.currentSelectedFilter,
        caption: els.captionInput.value.trim()
    };
    
    try {
        // Save to IndexedDB
        await savePhotoToDB(slotId, photoData);
        
        // Update DOM Slot immediately
        updateSlotDOM(slotId, photoData);
        
        // Close modal
        closeModalWindow();
    } catch(err) {
        console.error('Error saving image to IndexedDB: ', err);
        alert('عذراً، حدث خطأ أثناء حفظ الصورة.');
    }
});

// Delete Photo Modals Click
els.deletePhotoBtn.addEventListener('click', async () => {
    const slotId = state.activeSlotId;
    const confirmDelete = confirm('هل أنتِ متأكدة من حذف هذه الذكرى الجميلة؟');
    
    if (confirmDelete) {
        try {
            // Delete from Database
            await deletePhotoFromDB(slotId);
            
            // Reset to empty slot state
            resetSlotDOM(slotId);
            
            // Close modal
            closeModalWindow();
        } catch(err) {
            console.error('Error deleting from DB: ', err);
            alert('حدث خطأ أثناء محاولة إزالة الصورة.');
        }
    }
});

// Update the photo slot elements in real DOM
function updateSlotDOM(slotId, data) {
    // If it's a future slot, handle the pool thumbnails and visible displays
    if (slotId.startsWith('f')) {
        // 1. Update the Pool Card thumbnail & description
        const thumbImg = document.getElementById(`pool-thumb-${slotId}`);
        const descText = document.getElementById(`pool-desc-${slotId}`);
        if (thumbImg) {
            thumbImg.src = data.src;
            thumbImg.className = '';
            if (data.filter && data.filter !== 'normal') {
                thumbImg.classList.add(`filter-${data.filter}`);
            }
        }
        if (descText) {
            descText.innerText = data.caption || 'تفاصيل جميلة ✨';
        }
        
        // 2. If currently displayed on screen, update that display slot
        const activeIdx = activeFuturePoolKeys.indexOf(slotId);
        if (activeIdx !== -1) {
            const displaySlotId = `f-display-${activeIdx + 1}`;
            const displaySlotEl = document.getElementById(displaySlotId);
            if (displaySlotEl) {
                const imgEl = displaySlotEl.querySelector('.slot-image');
                const captionEl = displaySlotEl.querySelector('.slot-caption');
                const placeholderEl = displaySlotEl.querySelector('.slot-placeholder');
                
                imgEl.src = data.src;
                imgEl.className = 'slot-image has-image';
                if (data.filter && data.filter !== 'normal') {
                    imgEl.classList.add(`filter-${data.filter}`);
                }
                if (placeholderEl) placeholderEl.style.display = 'none';
                if (captionEl) captionEl.innerText = data.caption || 'بدون عنوان ✨';
            }
        }
        return; // Skip normal slot DOM binding
    }

    const slotEl = document.querySelector(`.photo-slot[data-slot-id="${slotId}"]`);
    if (slotEl) {
        const imgEl = slotEl.querySelector('.slot-image');
        const captionEl = slotEl.querySelector('.slot-caption');
        const placeholderEl = slotEl.querySelector('.slot-placeholder');
        
        // Load image source
        imgEl.src = data.src;
        imgEl.className = 'slot-image has-image';
        
        // Apply filter CSS
        if (data.filter && data.filter !== 'normal') {
            imgEl.classList.add(`filter-${data.filter}`);
        }
        
        // Hide placeholder
        if (placeholderEl) {
            placeholderEl.style.display = 'none';
        }
        
        // Set caption text
        if (captionEl) {
            captionEl.innerText = data.caption || 'بدون عنوان ✨';
        }
    }
}

// Reset photo slot DOM to placeholder state
function resetSlotDOM(slotId) {
    if (slotId.startsWith('f')) {
        // 1. Reset Pool Card Thumbnail & description
        const thumbImg = document.getElementById(`pool-thumb-${slotId}`);
        const descText = document.getElementById(`pool-desc-${slotId}`);
        if (thumbImg) {
            thumbImg.src = 'assets/photo1.png';
            thumbImg.className = '';
        }
        if (descText) {
            descText.innerText = 'اضغط لإضافة لقطة';
        }
        
        // 2. If visible, update display slot
        const activeIdx = activeFuturePoolKeys.indexOf(slotId);
        if (activeIdx !== -1) {
            const displaySlotId = `f-display-${activeIdx + 1}`;
            const displaySlotEl = document.getElementById(displaySlotId);
            if (displaySlotEl) {
                const imgEl = displaySlotEl.querySelector('.slot-image');
                const captionEl = displaySlotEl.querySelector('.slot-caption');
                const placeholderEl = displaySlotEl.querySelector('.slot-placeholder');
                
                imgEl.src = '';
                imgEl.className = 'slot-image';
                if (placeholderEl) placeholderEl.style.display = 'flex';
                if (captionEl) captionEl.innerText = 'اضغط لإضافة لقطة';
            }
        }
        return;
    }

    const slotEl = document.querySelector(`.photo-slot[data-slot-id="${slotId}"]`);
    if (slotEl) {
        const imgEl = slotEl.querySelector('.slot-image');
        const captionEl = slotEl.querySelector('.slot-caption');
        const placeholderEl = slotEl.querySelector('.slot-placeholder');
        
        // Reset image
        imgEl.src = '';
        imgEl.className = 'slot-image';
        
        // Show placeholder
        if (placeholderEl) {
            placeholderEl.style.display = 'flex';
        }
        
        // Clear caption text
        if (captionEl) {
            captionEl.innerText = 'اضغط لإضافة لقطة';
        }
    }
}

// ==========================================================================
// 6. FUTURE MOMENTS (DYNAMIC CAROUSEL SHUFFLE ENGINE)
// ==========================================================================
let activeFuturePoolKeys = ['f1', 'f2', 'f3', 'f4'];
let shuffleInterval = null;

// Pool drawer toggle action
if (els.togglePoolBtn && els.poolGridWrapper) {
    els.togglePoolBtn.addEventListener('click', () => {
        els.togglePoolBtn.classList.toggle('active');
        els.poolGridWrapper.classList.toggle('open');
    });
}

function startFutureShuffle() {
    if (shuffleInterval) clearInterval(shuffleInterval);
    
    shuffleInterval = setInterval(async () => {
        // Pick a random display slot on screen (0, 1, 2, or 3)
        const randSlotIdx = Math.floor(Math.random() * 4);
        const displaySlotId = `f-display-${randSlotIdx + 1}`;
        const displaySlotEl = document.getElementById(displaySlotId);
        
        if (!displaySlotEl) return;
        
        // Find keys in the pool (f1 to f6) that are NOT currently displayed on screen
        const availablePoolKeys = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].filter(
            key => !activeFuturePoolKeys.includes(key)
        );
        
        if (availablePoolKeys.length === 0) return;
        
        // Pick a random new key to show
        const newPoolKey = availablePoolKeys[Math.floor(Math.random() * availablePoolKeys.length)];
        
        // Trigger Shuffle-Out animation
        displaySlotEl.classList.add('shuffling-out');
        
        // Wait for fade out to complete (600ms matching CSS transition)
        setTimeout(async () => {
            // Update active state array
            activeFuturePoolKeys[randSlotIdx] = newPoolKey;
            
            // Set the active slot element's data-slot-id so clicking it targets the correct pool item
            displaySlotEl.setAttribute('data-slot-id', newPoolKey);
            
            // Query details for newPoolKey
            const savedPhoto = await getPhotoFromDB(newPoolKey);
            const data = savedPhoto || DEFAULT_PHOTOS[newPoolKey];
            
            // Update the display slot DOM
            const imgEl = displaySlotEl.querySelector('.slot-image');
            const captionEl = displaySlotEl.querySelector('.slot-caption');
            const placeholderEl = displaySlotEl.querySelector('.slot-placeholder');
            
            if (data && data.src) {
                imgEl.src = data.src;
                imgEl.className = 'slot-image has-image';
                
                // Clear any filter classes
                if (data.filter && data.filter !== 'normal') {
                    imgEl.classList.add(`filter-${data.filter}`);
                }
                
                if (placeholderEl) placeholderEl.style.display = 'none';
                if (captionEl) captionEl.innerText = data.caption || 'ذكريات المستقبل ✨';
            } else {
                imgEl.src = '';
                imgEl.className = 'slot-image';
                if (placeholderEl) placeholderEl.style.display = 'flex';
                if (captionEl) captionEl.innerText = 'اضغط لإضافة لقطة';
            }
            
            // Trigger Fade-In by removing class
            displaySlotEl.classList.remove('shuffling-out');
        }, 600);
        
    }, 4500); // Shuffle every 4.5 seconds
}

// ==========================================================================
// 7. STARTUP INITIALIZATION ENGINE
// ==========================================================================
async function initApp() {
    try {
        // Load saved images from IndexedDB
        for (const slotId of Object.keys(DEFAULT_PHOTOS)) {
            const savedPhoto = await getPhotoFromDB(slotId);
            
            if (savedPhoto) {
                // If user has customized this photo slot, load it!
                updateSlotDOM(slotId, savedPhoto);
            } else {
                // Otherwise, load default scenic illustrations we prepared
                updateSlotDOM(slotId, DEFAULT_PHOTOS[slotId]);
            }
        }
        
        // Start the Future moments shuffling loop
        startFutureShuffle();
    } catch(err) {
        console.error('App init failed to load IndexedDB: ', err);
        // Fallback: Default templates loaded via HTML remain unchanged
        startFutureShuffle();
    }
}

// Kick off app rendering
initApp();
