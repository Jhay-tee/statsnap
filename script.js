// Configuration constants
const CONFIG = {
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    DEFAULT_RATIO: '1080x1920',
    QUALITY: 0.96,
    DEBOUNCE_DELAY: 300,
    MAX_DIMENSION: 10000
};

// DOM Elements
const select = document.getElementById("screenratio");
const statusBox = document.querySelector(".status-box");
const txtcolor = document.getElementById("txtcol");
const statusText = document.querySelector(".editable-text");
const backgcol = document.getElementById("bkgcol");
const backimg = document.getElementById("backimg");
const gradientSelect = document.getElementById("gradientSelect");
const fontSize = document.getElementById("fontsize");
const fontWeight = document.getElementById("fontweight");

// Status Manager Object for better organization
const StatusManager = {
    init() {
        this.loadSavedState();
        this.bindEvents();
        this.enhanceAccessibility();
    },
    
    loadSavedState() {
        try {
            const config = {
                theme: localStorage.getItem('theme'),
                fontSize: localStorage.getItem('fontSize'),
                fontWeight: localStorage.getItem('fontWeight'),
                screenratio: localStorage.getItem('screenratio'),
                fontSelect: localStorage.getItem('fontSelect'),
                txtcolor: localStorage.getItem('txtcolor'),
                bkgcol: localStorage.getItem('bkgcol'),
                gradientSelect: localStorage.getItem('gradientSelect'),
                statusText: localStorage.getItem('statusText'),
                logo: localStorage.getItem('logo')
            };
            
            Object.entries(config).forEach(([key, value]) => {
                if (value) this.applySetting(key, value);
            });

            // Load background image
            const bgData = localStorage.getItem('bgImageData');
            if (bgData) {
                statusBox.style.backgroundImage = `url("${bgData}")`;
                statusBox.style.backgroundSize = 'cover';
                statusBox.style.backgroundPosition = 'center';
                statusBox.style.backgroundRepeat = 'no-repeat';
                statusBox.style.backgroundColor = 'transparent';
            }

            this.loadSharedStatus();
        } catch (err) {
            console.error('Error loading saved state:', err);
        }
    },
    
    applySetting(key, value) {
        const setters = {
            theme: (val) => this.setTheme(val),
            fontSize: (val) => {
                if (fontSize) {
                    fontSize.value = val;
                    updateFontSize();
                }
            },
            fontWeight: (val) => {
                if (fontWeight) {
                    fontWeight.value = val;
                    updateFontWeight();
                }
            },
            screenratio: (val) => {
            if (select) {
                select.value = val;
                // ADD THESE LINES to actually apply the ratio:
                let [w, h] = val.split("x");
                statusBox.style.width = (w/4) + "px";
                statusBox.style.height = (h/4) + "px";
            }
            },
            fontSelect: (val) => {
                const fontSelect = document.getElementById("fontSelect");
                if (fontSelect && statusText) {
                    fontSelect.value = val;
                    statusText.style.fontFamily = val;
                }
            },
            txtcolor: (val) => {
                if (txtcolor && statusText) {
                    txtcolor.value = val;
                    setcolor();
                }
            },
            bkgcol: (val) => {
                if (backgcol && statusBox) {
                    backgcol.value = val;
                    backgcolz();
                }
            },
            gradientSelect: (val) => {
                if (gradientSelect) {
                    gradientSelect.value = val;
                    applyGradient();
                }
            },
            statusText: (val) => {
                if (statusText) {
                    statusText.textContent = val;
                }
            },
            logo: (val) => {
                const image = document.getElementById("logo");
                if (image && val) {
                    image.setAttribute("src", val);
                }
            }
        };
        
        if (setters[key]) setters[key](value);
    },
    
    setTheme(theme) {
        const themeLink = document.getElementById("theme");
        const image = document.getElementById("logo");
        const darkBtn = document.getElementById("darkModeToggle");
        
        if (themeLink && theme) {
            themeLink.setAttribute("href", theme);
            if (darkBtn) {
                darkBtn.innerText = theme.includes('darkstyle') ? '☀️' : '🌙';
            }
            if (image) {
                const logo = theme.includes('darkstyle') ? "darkthemeicon.png" : "lightthemeicon.png";
                image.setAttribute("src", logo);
            }
        }
    },
    
    bindEvents() {
        // Font size
        if (fontSize) {
            fontSize.addEventListener('input', debounce(updateFontSize, CONFIG.DEBOUNCE_DELAY));
        }
        
        // Font weight
        if (fontWeight) {
            fontWeight.addEventListener('input', debounce(updateFontWeight, CONFIG.DEBOUNCE_DELAY));
        }
        
        // Dark theme toggle
        const darkBtn = document.getElementById("darkModeToggle");
        if (darkBtn) {
            darkBtn.addEventListener("click", toggleTheme);
        }
        
        // Screen ratio
        if (select) {
            select.addEventListener('change', () => {
                let [w,h] = select.value.split("x");
                if (this.validateDimensions(parseInt(w), parseInt(h))) {
                    statusBox.style.width = (w/4)+ "px";
                    statusBox.style.height = (h/4) + "px";
                    this.safeLocalStorageSet('screenratio', select.value);
                }
            });
        }
        
        // Font family
        const fontSelect = document.getElementById("fontSelect");
        if (fontSelect) {
            fontSelect.addEventListener("change", () => {
                const selectedFont = fontSelect.value;
                statusText.style.fontFamily = selectedFont;
                this.safeLocalStorageSet('fontSelect', selectedFont);
            });
        }
        
        // Text color
        if (txtcolor) {
            txtcolor.addEventListener("input", debounce(() => {
                setcolor();
                this.safeLocalStorageSet('txtcolor', txtcolor.value);
            }, CONFIG.DEBOUNCE_DELAY));
        }
        
        // Background color
        if (backgcol) {
            backgcol.addEventListener('input', debounce(() => {
                backgcolz();
                this.safeLocalStorageSet('bkgcol', backgcol.value);
            }, CONFIG.DEBOUNCE_DELAY));
        }
        
        // Background image
        if (backimg) {
            backimg.addEventListener("change", backgImg);
        }
        
        // Gradient
        if (gradientSelect) {
            gradientSelect.addEventListener("change", () => {
                applyGradient();
                this.safeLocalStorageSet('gradientSelect', gradientSelect.value);
            });
        }
        
        // Status text
        if (statusText) {
            statusText.addEventListener('input', debounce(() => {
                const txt = (statusText.innerText || statusText.textContent || '').replace(/\u200B/g, '').trim();
                this.safeLocalStorageSet('statusText', txt);
            }, CONFIG.DEBOUNCE_DELAY));
        }
        
        // Download button
        const downloadBtn = document.getElementById("downloadBtn");
        if (downloadBtn) {
            downloadBtn.addEventListener("click", downloadImage);
        }
        
        // Share button
        const shareBtn = document.getElementById("copyBtn");
        if (shareBtn) {
            shareBtn.addEventListener("click", shareStatus);
        }
        
        // Set default ratio
        document.addEventListener('DOMContentLoaded', () => {
            if (select && !localStorage.getItem('screenratio')) {
                select.value = CONFIG.DEFAULT_RATIO;
                select.dispatchEvent(new Event('change'));
            }
        });
    },
    
    enhanceAccessibility() {
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.setAttribute('aria-label', 'Download status image');
            downloadBtn.setAttribute('role', 'button');
        }
        
        const shareBtn = document.getElementById('copyBtn');
        if (shareBtn) {
            shareBtn.setAttribute('aria-label', 'Share status image');
            shareBtn.setAttribute('role', 'button');
        }
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const popup = document.getElementById('downloadProgressPopup');
                if (popup) hideDownloadProgressPopup();
            }
        });
    },
    
    validateDimensions(width, height) {
        return width > 0 && height > 0 && width <= CONFIG.MAX_DIMENSION && height <= CONFIG.MAX_DIMENSION;
    },
    
    safeLocalStorageSet(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.warn('LocalStorage quota exceeded:', e);
            this.showStorageError();
            return false;
        }
    },
    
    showStorageError() {
        const existingError = document.getElementById('storageError');
        if (existingError) return;
        
        const errorDiv = document.createElement('div');
        errorDiv.id = 'storageError';
        errorDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #ff4444;
            color: white;
            padding: 10px;
            border-radius: 5px;
            z-index: 10000;
        `;
        errorDiv.textContent = 'Storage full - settings not saved';
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    },
    
    loadSharedStatus() {
        // Implementation for loading shared status
        console.log('Load shared status functionality');
    }
};

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function setLoadingState(element, isLoading) {
    if (isLoading) {
        element.disabled = true;
        element.dataset.originalText = element.textContent;
        element.textContent = 'Loading...';
    } else {
        element.disabled = false;
        element.textContent = element.dataset.originalText;
    }
}

function cleanupBackgroundImage() {
    const currentBg = statusBox.style.backgroundImage;
    if (currentBg.includes('blob:')) {
        try {
            URL.revokeObjectURL(currentBg.replace('url("', '').replace('")', ''));
        } catch (e) {
            console.warn('Error cleaning up blob URL:', e);
        }
    }
}

// Core Functionality
function updateFontSize() {
    if (!fontSize || !statusText) return;
    
    const size = fontSize.value + 'px';
    statusText.style.fontSize = size;
    StatusManager.safeLocalStorageSet('fontSize', fontSize.value);
}

function updateFontWeight() {
    if (!fontWeight || !statusText) return;
    
    const weight = fontWeight.value;
    statusText.style.fontWeight = Number(weight);
    StatusManager.safeLocalStorageSet('fontWeight', weight);
}

function toggleTheme() {
    const themeLink = document.getElementById("theme");
    const image = document.getElementById("logo");
    const btn = document.getElementById("darkModeToggle");
    
    if (!themeLink || !image || !btn) return;
    
    const currentTheme = themeLink.getAttribute("href");
    
    if (currentTheme === "lightstyle.css") {
        themeLink.setAttribute("href", "darkstyle.css");
        image.setAttribute("src", "darkthemeicon.png");
        btn.innerText = "☀️";
    } else {
        themeLink.setAttribute("href", "lightstyle.css");
        image.setAttribute("src", "lightthemeicon.png");
        btn.innerText = "🌙";
    }
    
    // Save theme state
    StatusManager.safeLocalStorageSet('logo', image.getAttribute("src"));
    StatusManager.safeLocalStorageSet('theme', themeLink.getAttribute("href"));
}

function setcolor() {
    if (!statusText || !txtcolor) return;
    
    statusText.style.color = txtcolor.value;
    const txtcolz = document.getElementById("txtcolz");
    if (txtcolz) {
        txtcolz.style.backgroundColor = txtcolor.value;
    }
}

function backgcolz() {
    if (!statusBox || !backgcol) return;
    
    statusBox.style.backgroundColor = backgcol.value;
    statusBox.style.backgroundImage = "none";
    const bckgcolz = document.getElementById("bckgcolz");
    if (bckgcolz) {
        bckgcolz.style.backgroundColor = backgcol.value;
    }
}

function backgImg() {
    cleanupBackgroundImage();
    
    const file = backimg.files[0];
    statusBox.style.backgroundColor = "transparent";
    
    if (!file) return;

    // Check file size
    if (file.size > CONFIG.MAX_IMAGE_SIZE) {
        alert('Please select an image smaller than 5MB');
        backimg.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function () {
        statusBox.style.backgroundImage = `url("${reader.result}")`;
        statusBox.style.backgroundSize = 'cover';
        statusBox.style.backgroundPosition = 'center';
        statusBox.style.backgroundRepeat = 'no-repeat';
        
        // Save to localStorage
        try {
            StatusManager.safeLocalStorageSet('bgImageData', reader.result);
        } catch (e) {
            console.warn('Could not save image to localStorage (file too large).', e);
        }
    };
    reader.onerror = function () {
        alert('Error reading file. Please try another image.');
    };
    reader.readAsDataURL(file);
}

function applyGradient() {
    if (!statusBox || !gradientSelect || !backgcol || !txtcolor) return;
    
    const selectedGradient = gradientSelect.value;
    if (selectedGradient === "none") {
        statusBox.style.backgroundImage = "none";
    } else if (selectedGradient === "radial") {
        statusBox.style.backgroundImage = `radial-gradient(circle, ${backgcol.value}, ${txtcolor.value})`;
    } else {
        statusBox.style.backgroundImage = `linear-gradient(${selectedGradient}, ${backgcol.value}, ${txtcolor.value})`;
    }
}

// FIXED CLONE CREATION FUNCTION - CONSISTENT BETWEEN DOWNLOAD AND SHARE
function createHighQualityClone() {
    const [wStr, hStr] = (select.value || CONFIG.DEFAULT_RATIO).split("x");
    const targetW = parseInt(wStr, 10);
    const targetH = parseInt(hStr, 10);
    
    if (!StatusManager.validateDimensions(targetW, targetH)) {
        throw new Error('Invalid dimensions selected');
    }

    // Create clone
    const clone = statusBox.cloneNode(true);
    
    // Get original dimensions and calculate proper scale factor
    const originalWidth = statusBox.offsetWidth;
    const originalHeight = statusBox.offsetHeight;
    const scaleFactor = targetW / originalWidth;

    // Get computed styles from original
    const originalStyles = window.getComputedStyle(statusBox);

    // Apply scaled container styles - NO FILTERS
    clone.style.cssText = `
        width: ${targetW}px;
        height: ${targetH}px;
        min-width: ${targetW}px;
        min-height: ${targetH}px;
        max-width: ${targetW}px;
        max-height: ${targetH}px;
        position: absolute;
        left: 0;
        top: 0;
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        background-image: ${originalStyles.backgroundImage};
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        background-color: ${originalStyles.backgroundColor};
        display: flex;
        align-items: center;
        justify-content: center;
        image-rendering: crisp-edges;
        filter: none !important;
        -webkit-filter: none !important;
    `;

    // Scale text properly
    const cloneText = clone.querySelector('.editable-text');
    if (cloneText) {
        const textStyles = window.getComputedStyle(statusText);
        
        // Scale all text properties proportionally - NO FILTERS
        cloneText.style.cssText = `
            font-size: ${parseFloat(textStyles.fontSize) * scaleFactor}px;
            font-weight: ${textStyles.fontWeight};
            line-height: ${parseFloat(textStyles.lineHeight) * scaleFactor}px;
            text-align: center;
            color: ${textStyles.color};
            font-family: ${textStyles.fontFamily};
            width: 100%;
            padding: ${20 * scaleFactor}px;
            margin: 0;
            box-sizing: border-box;
            word-wrap: break-word;
            white-space: pre-wrap;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 0;
            position: relative;
            transform: none;
            left: auto;
            top: auto;
            right: auto;
            bottom: auto;
            filter: none !important;
            -webkit-filter: none !important;
        `;

        cloneText.innerHTML = statusText.innerHTML;
    }

    return { clone, targetW, targetH };
}

// Image Import Functionality 
function getImage() {
    // Check internet connection first
    if (!navigator.onLine) {
        showNoInternetPopup();
        return;
    }
    
    const [width, height] = (select.value || CONFIG.DEFAULT_RATIO).split("x");
    if (!StatusManager.validateDimensions(parseInt(width), parseInt(height))) {
        alert('Invalid dimensions selected');
        return;
    }
    
    const url = `https://picsum.photos/${width}/${height}?${Date.now()}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    setLoadingState(document.getElementById('importBtn'), true);
    
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0);
        try {
            const dataUrl = canvas.toDataURL('image/jpeg');
            statusBox.style.backgroundImage = `url("${dataUrl}")`;
            statusBox.style.backgroundSize = 'cover';
            statusBox.style.backgroundPosition = 'center';
            statusBox.style.backgroundRepeat = 'no-repeat';
            StatusManager.safeLocalStorageSet('bgImageData', dataUrl);
        } catch (e) {
            // Fallback to direct URL
            statusBox.style.backgroundImage = `url("${url}")`;
            statusBox.style.backgroundSize = 'cover';
            statusBox.style.backgroundPosition = 'center';
            statusBox.style.backgroundRepeat = 'no-repeat';
        } finally {
            setLoadingState(document.getElementById('importBtn'), false);
        }
    };
    
    img.onerror = () => {
        alert('Failed to load image. Please try again.');
        setLoadingState(document.getElementById('importBtn'), false);
    };
    
    img.src = url;
}

// Popup Functions
function showDownloadProgressPopup() {
    const popup = document.createElement('div');
    popup.id = 'downloadProgressPopup';
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 30px;
        border-radius: 15px;
        z-index: 10000;
        text-align: center;
        min-width: 300px;
        box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
    `;
    
    popup.innerHTML = `
        <h3 style="margin-bottom: 20px; color: #25D366;">Stay chill 😌 🔄 Generating Your Status</h3>
        <div style="margin-bottom: 20px;">
            <div style="width: 100%; background-color: #333; border-radius: 10px; overflow: hidden;">
                <div id="progressBar" style="height: 8px; background-color: #25D366; width: 0%; transition: width 0.3s;"></div>
            </div>
            <p id="progressText" style="margin-top: 10px; font-size: 14px;">Preparing image...Do the calms 🙃</p>
        </div>
        <button id="hidePopupBtn" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 12px;">
            Hide (download will continue)
        </button>
    `;
    
    document.body.appendChild(popup);
    
    // Add hide functionality
    document.getElementById('hidePopupBtn').addEventListener('click', function() {
        popup.style.display = 'none'; 
    });
    
    return popup;
}

function updateDownloadProgress(percentage, message) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if (progressBar) {
        progressBar.style.width = percentage + '%';
    }
    if (progressText) {
        progressText.textContent = message;
    }
}

function hideDownloadProgressPopup() {
    const popup = document.getElementById('downloadProgressPopup');
    if (popup && popup.parentNode) {
        popup.parentNode.removeChild(popup);
    }
}

function showNoInternetPopup() {
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 30px;
        border-radius: 15px;
        z-index: 10000;
        text-align: center;
        min-width: 300px;
        box-shadow: 0 0 20px rgba(255, 0, 0, 0.3);
    `;
    
    popup.innerHTML = `
        <h3 style="margin-bottom: 20px; color: #ff4444;">🌐 No Internet Connection</h3>
        <p style="margin-bottom: 20px;">Please check your internet connection and try again.</p>
        <button onclick="this.parentElement.remove()" style="background: #ff4444; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
            OK
        </button>
    `;
    
    document.body.appendChild(popup);
}

// Download Functionality - FIXED TO USE CONSISTENT STYLING
// Download Recommendation Popup Function
function showDownloadRecommendationPopup() {
    return new Promise((resolve) => {
        const popup = document.createElement('div');
        popup.id = 'downloadRecommendationPopup';
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(0, 0, 0, 0.95);
            color: white;
            padding: 30px;
            border-radius: 15px;
            z-index: 10001;
            text-align: center;
            min-width: 350px;
            max-width: 90vw;
            box-shadow: 0 0 30px rgba(255, 255, 255, 0.2);
            font-family: Arial, sans-serif;
            backdrop-filter: blur(10px);
        `;
        
        popup.innerHTML = `
            <h3 style="margin-bottom: 20px; color: #25D366;">📱 Recommendation</h3>
            <div style="margin-bottom: 25px;">
                <p style="margin-bottom: 15px; font-size: 16px; line-height: 1.5;">
                    <strong>We recommend sharing instead of downloading!</strong>
                </p>
                <p style="margin-bottom: 10px; font-size: 14px; color: #ccc;">
                    ⚠️ Downloaded images may appear darker depending on device 
                </p>
                <p style="margin-bottom: 10px; font-size: 14px; color: #ccc;">
                    ✅ Shared images maintain original brightness and quality
                </p>
            </div>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button id="shareInsteadBtn" style="background: #25D366; color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; flex: 1;">
                    Share Instead
                </button>
                <button id="downloadAnywayBtn" style="background: #007bff; color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; flex: 1;">
                    Download Anyway
                </button>
            </div>
            <div style="margin-top: 15px;">
                <button id="cancelDownloadBtn" style="background: transparent; color: #ccc; border: 1px solid #666; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                    Cancel
                </button>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // Add event handlers
        document.getElementById('shareInsteadBtn').addEventListener('click', () => {
            popup.remove();
            // Trigger share function instead
            const shareBtn = document.getElementById("copyBtn");
            if (shareBtn) {
                shareBtn.click();
            }
            resolve(false);
        });
        
        document.getElementById('downloadAnywayBtn').addEventListener('click', () => {
            popup.remove();
            resolve(true); // Proceed with download
        });
        
        document.getElementById('cancelDownloadBtn').addEventListener('click', () => {
            popup.remove();
            resolve(false); // Cancel download
        });
        
        // Close on escape key
        const closeOnEscape = (e) => {
            if (e.key === 'Escape') {
                popup.remove();
                document.removeEventListener('keydown', closeOnEscape);
                resolve(false);
            }
        };
        document.addEventListener('keydown', closeOnEscape);
        
        // Close on background click
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                popup.remove();
                document.removeEventListener('keydown', closeOnEscape);
                resolve(false);
            }
        });
    });
}

// Updated Download Functionality
function downloadImage() {
    showDownloadRecommendationPopup().then(proceedWithDownload => {
        if (!proceedWithDownload) {
            return; // User chose to share instead or cancel
        }
        
        // Check internet connection for web images
        const computedStyle = window.getComputedStyle(statusBox);
        if (computedStyle.backgroundImage.includes('url("http') && !navigator.onLine) {
            showNoInternetPopup();
            return;
        }

        const downloadBtn = document.getElementById('downloadBtn');
        if (!downloadBtn) return;
        
        setLoadingState(downloadBtn, true);

        try {
            // Use shared clone creation
            const { clone, targetW, targetH } = createHighQualityClone();

            // Show progress popup
            const progressPopup = showDownloadProgressPopup();
            updateDownloadProgress(10, 'Initializing download...');

            // Create temporary container
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.width = targetW + 'px';
            container.style.height = targetH + 'px';
            container.style.overflow = 'hidden';
            container.style.border = "none";
            container.style.boxShadow = "none";
            container.style.filter = "none";
            container.appendChild(clone);
            document.body.appendChild(container);

            updateDownloadProgress(40, 'Rendering image...');

            // Use dom-to-image with consistent options
            setTimeout(() => {
                updateDownloadProgress(70, 'Finalizing quality...');
                
                domtoimage.toJpeg(clone, {
                    width: targetW,
                    height: targetH,
                    quality: CONFIG.QUALITY,
                    bgcolor: window.getComputedStyle(statusBox).backgroundColor,
                    style: {
                        'transform': 'none',
                        'width': targetW + 'px',
                        'height': targetH + 'px',
                        'margin': '0',
                        'padding': '0',
                        'filter': 'none',
                        '-webkit-filter': 'none'
                    },
                    filter: function(node) {
                        // Remove all filters from all elements
                        if (node.style) {
                            node.style.filter = 'none';
                            node.style.webkitFilter = 'none';
                        }
                        return true;
                    }
                }).then(function(dataUrl) {
                    if (container.parentNode) {
                        document.body.removeChild(container);
                    }
                    
                    const link = document.createElement('a');
                    link.download = `whatsapp-status-${targetW}x${targetH}-${Date.now()}.jpeg`;
                    link.href = dataUrl;
                    link.click();

                    updateDownloadProgress(100, 'Image rendered, download will begin now');
                    
                    setTimeout(() => {
                        hideDownloadProgressPopup();
                        setLoadingState(downloadBtn, false);
                    }, 1000);
                    
                }).catch(function(error) {
                    if (container.parentNode) {
                        document.body.removeChild(container);
                    }
                    hideDownloadProgressPopup();
                    console.error('dom-to-image error:', error);
                    alert('Failed to generate image. Please try again.');
                    setLoadingState(downloadBtn, false);
                });
            }, 300);

        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to create image. Please try again.');
            setLoadingState(downloadBtn, false);
        }
    });
}

// Share Functionality - FIXED TO USE CONSISTENT STYLING
async function shareStatus() {
    try {
        const shareBtn = document.getElementById("copyBtn");
        setLoadingState(shareBtn, true);

        // Use shared clone creation
        const { clone, targetW, targetH } = createHighQualityClone();

        // Create high-quality image for sharing using the SAME options as download
        const dataUrl = await domtoimage.toJpeg(clone, {
            width: targetW,
            height: targetH,
            quality: CONFIG.QUALITY,
            style: {
                'transform': 'none',
                'width': targetW + 'px',
                'height': targetH + 'px',
                'margin': '0',
                'padding': '0',
                'filter': 'none',
                '-webkit-filter': 'none'
            },
            filter: function(node) {
                // Remove all filters from all elements
                if (node.style) {
                    node.style.filter = 'none';
                    node.style.webkitFilter = 'none';
                }
                return true;
            }
        });
        
        // Convert data URL to blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'whatsapp-status.jpg', { type: 'image/jpeg' });
        
        // Enhanced platform detection and sharing
        //await handleSharing(file, dataUrl, blob);
        //shareImageMobile(dataUrl, blob)
         if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        await shareImageMobile(dataUrl, blob);
    } else {
        // Desktop fallback
        await handleSharing(file, dataUrl, blob);
    }
        
    } catch (error) {
        console.error('Share failed:', error);
        alert('Sharing failed. You can download the image instead.');
    } finally {
        const shareBtn = document.getElementById("copyBtn");
        setLoadingState(shareBtn, false);
    }
}

async function handleSharing(file, dataUrl, blob) {
    // Check if Web Share API is available and can share files
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: 'WhatsApp Status',
                text: 'Check out my status!'
            });
            return;
        } catch (shareError) {
            console.log('Web Share failed, falling back to alternative methods:', shareError);
            await handleSharing(file, dataUrl, blob)
        }
    }
    
    // For mobile apps - use proper image sharing
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        await shareImageMobile(dataUrl, blob);
    } else {
        // Desktop fallback
        await showSharingOptions(file, dataUrl, blob);
    }
}

// MOBILE IMAGE SHARING
async function shareImageMobile(dataUrl, blob) {
    const sharePopup = document.createElement('div');
    sharePopup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 25px;
        border-radius: 15px;
        z-index: 10000;
        text-align: center;
        min-width: 300px;
        backdrop-filter: blur(10px);
    `;
    
    sharePopup.innerHTML = `
        <h3 style="margin-bottom: 20px; color: #25D366;">Share Image</h3>
        <p style="margin-bottom: 20px;">Choose how to share your status image:</p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <button id="shareWhatsApp" style="background: #25D366; color: white; border: none; padding: 15px; border-radius: 10px; cursor: pointer; font-size: 16px;">
                💚 Share Status
            </button>
            <button id="downloadMobile" style="background: #007bff; color: white; border: none; padding: 15px; border-radius: 10px; cursor: pointer; font-size: 16px;">
                💾 Download Image
            </button>
            <button id="cancelMobile" style="background: #666; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px;">
                Cancel
            </button>
        </div>
    `;
    
    document.body.appendChild(sharePopup);
    
    // Share via native app picker
    document.getElementById('shareNative').addEventListener('click', async () => {
        try {
            // Create a temporary file URL for sharing
            const fileUrl = URL.createObjectURL(blob);
            
            // For mobile devices, create a download link and trigger share
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = 'whatsapp-status.jpg';
            link.click();
            
            showTemporaryMessage('✅ Image saved! You can now share it from your gallery');
            
        } catch (error) {
            console.error('Native share failed:', error);
            shareImageFallback(dataUrl);
        }
        sharePopup.remove();
    });
    
    // Share to WhatsApp specifically
    document.getElementById('shareWhatsApp').addEventListener('click', () => {
        shareToWhatsAppDirect(blob, dataUrl);
        sharePopup.remove();
    });
    
    // Download
    document.getElementById('downloadMobile').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `whatsapp-status-${Date.now()}.jpg`;
        link.href = dataUrl;
        link.click();
        sharePopup.remove();
    });
    
    document.getElementById('cancelMobile').addEventListener('click', () => {
        sharePopup.remove();
    });
}

// DIRECT WHATSAPP SHARING
function shareToWhatsAppDirect(blob, dataUrl) {
    // Create a temporary file
    const file = new File([blob], 'status.jpg', { type: 'image/jpeg' });
    
    if (navigator.share && navigator.canShare({ files: [file] })) {
        // Use Web Share API for WhatsApp
        navigator.share({
            files: [file],
            title: 'WhatsApp Status',
            text: 'My WhatsApp Status'
        }).catch(error => {
            console.log('Web Share failed, trying fallback:', error);
            shareToWhatsAppFallback(dataUrl);
        });
    } else {
        // Fallback for older browsers
        shareToWhatsAppFallback(dataUrl);
    }
}

function shareToWhatsAppFallback(dataUrl) {
    // Convert data URL to blob URL for sharing
    const byteString = atob(dataUrl.split(',')[1]);
    const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    
    const blob = new Blob([ab], { type: mimeString });
    const blobUrl = URL.createObjectURL(blob);
    
    // Open WhatsApp with the image
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent('Check out my status!')}`;
    window.open(whatsappUrl, '_blank');
    
    showTemporaryMessage('📱 Open WhatsApp and attach the image from your downloads');
}

// DESKTOP SHARING - IMPROVED
async function showSharingOptions(file, dataUrl, blob) {
    const sharePopup = document.createElement('div');
    sharePopup.id = 'shareOptionsPopup';
    sharePopup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 30px;
        border-radius: 15px;
        z-index: 10000;
        text-align: center;
        min-width: 400px;
        max-width: 90vw;
        box-shadow: 0 0 30px rgba(255, 255, 255, 0.2);
        font-family: Arial, sans-serif;
        backdrop-filter: blur(10px);
    `;
    
    sharePopup.innerHTML = `
        <h3 style="margin-bottom: 25px; color: #25D366; font-size: 1.4em;">Share Your Status Image</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
            <button id="downloadShareBtn" class="share-option-btn" data-action="download">
                <span style="font-size: 1.5em;">💾</span>
                <span>Download Image</span>
            </button>
            <button id="clipboardShareBtn" class="share-option-btn" data-action="clipboard">
                <span style="font-size: 1.5em;">📋</span>
                <span>Copy Image</span>
            </button>
            <button id="dragShareBtn" class="share-option-btn" data-action="drag">
                <span style="font-size: 1.5em;">🖱️</span>
                <span>Drag & Drop</span>
            </button>
        </div>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #444;">
            <button id="closeSharePopup" style="background: #666; color: white; border: none; padding: 10px 25px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: background 0.3s;">
                Cancel
            </button>
        </div>
    `;
    
    // Add CSS for share buttons
    const style = document.createElement('style');
    style.textContent = `
        .share-option-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 20px 15px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            min-height: 80px;
            justify-content: center;
        }
        .share-option-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
        }
        .share-option-btn:active {
            transform: translateY(0);
        }
        #closeSharePopup:hover {
            background: #888 !important;
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(sharePopup);
    
    // Button event handlers
    document.getElementById('downloadShareBtn').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `whatsapp-status-${Date.now()}.jpg`;
        link.href = dataUrl;
        link.click();
        showTemporaryMessage('✅ Image downloaded! view in Gallery');
        sharePopup.remove();
        style.remove();
    });
    
    document.getElementById('clipboardShareBtn').addEventListener('click', async () => {
        try {
            if (navigator.clipboard && window.ClipboardItem) {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/jpeg': blob })
                ]);
                showTemporaryMessage('✅ Image copied to clipboard! You can paste it anywhere');
            } else {
                throw new Error('Clipboard API not supported');
            }
        } catch (error) {
            console.error('Clipboard copy failed:', error);
            showTemporaryMessage('❌ Copy failed. Please download the image instead.');
        }
    });
    
    /*document.getElementById('previewShareBtn').addEventListener('click', () => {
        openImagePreview(dataUrl);
        sharePopup.remove();
        style.remove();
    });*/
    
    document.getElementById('dragShareBtn').addEventListener('click', () => {
        createDraggableImage(dataUrl, blob);
        sharePopup.remove();
        style.remove();
    });
    
    document.getElementById('closeSharePopup').addEventListener('click', () => {
        sharePopup.remove();
        style.remove();
    });
    
    // Close handlers
    const closeOnEscape = (e) => {
        if (e.key === 'Escape') {
            sharePopup.remove();
            style.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    };
    document.addEventListener('keydown', closeOnEscape);
    
    sharePopup.addEventListener('click', (e) => {
        if (e.target === sharePopup) {
            sharePopup.remove();
            style.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    });
}

// CREATE DRAGGABLE IMAGE FOR DESKTOP SHARING
function createDraggableImage(dataUrl, blob) {
    const dragImage = document.createElement('div');
    dragImage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10001;
        cursor: grab;
        border: 3px dashed #25D366;
        border-radius: 10px;
        padding: 10px;
        background: white;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    `;
    
    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.cssText = `
        max-width: 300px;
        max-height: 300px;
        display: block;
        border-radius: 5px;
    `;
    
    const instruction = document.createElement('div');
    instruction.style.cssText = `
        text-align: center;
        color: #333;
        margin-top: 10px;
        font-weight: bold;
    `;
    instruction.textContent = 'Drag this image to any app or folder';
    
    dragImage.appendChild(img);
    dragImage.appendChild(instruction);
    document.body.appendChild(dragImage);
    
    // Make image draggable
    dragImage.draggable = true;
    
    dragImage.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', dataUrl);
        e.dataTransfer.setData('text/uri-list', dataUrl);
        e.dataTransfer.effectAllowed = 'copy';
        
        // Create a drag image
        const dragImg = new Image();
        dragImg.src = dataUrl;
        e.dataTransfer.setDragImage(dragImg, 0, 0);
    });
    
    dragImage.addEventListener('click', () => {
        dragImage.remove();
    });
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (dragImage.parentNode) {
            dragImage.remove();
        }
    }, 10000);
}

// Utility function to show temporary messages
function showTemporaryMessage(message, parentElement = document.body) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #25D366;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        z-index: 10001;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        font-weight: bold;
    `;
    messageDiv.textContent = message;
    
    parentElement.appendChild(messageDiv);
    
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 3000);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    StatusManager.init();
});