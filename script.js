const select = document.getElementById("screenratio");
const statusBox = document.querySelector(".status-box");
const txtcolor = document.getElementById("txtcol");
const statusText = document.querySelector(".editable-text");
const backgcol = document.getElementById("bkgcol");
const backimg = document.getElementById("backimg");
const gradientSelect = document.getElementById("gradientSelect");
const fontSize = document.getElementById("fontsize");
const fontWeight = document.getElementById("fontweight");

// FONT SIZE FUNCTIONALITY
function updateFontSize() {
  const size = fontSize.value + 'px';
  statusText.style.fontSize = size;
  localStorage.setItem('fontSize', fontSize.value);
}

fontSize.addEventListener('input', updateFontSize);

// FONT WEIGHT FUNCTIONALITY
function updateFontWeight() {
  const weight = document.getElementById("fontweight").value;
  statusText.style.fontWeight = Number(weight);
  localStorage.setItem('fontWeight', weight);
}

fontWeight.addEventListener('input', updateFontWeight);

// DARK THEME TOGGLE
function toggleTheme(){
  const themeLink = document.getElementById("theme");
  const currentTheme = themeLink.getAttribute("href");
  const image = document.getElementById("logo");
  const currentImage = image.getAttribute("src");
  const btn = document.getElementById("darkModeToggle");

  if (currentTheme === "lightstyle.css"){
    themeLink.setAttribute("href","darkstyle.css");
    image.setAttribute("src", "darkthemeicon.png");
    btn.innerText = "☀️";
  }
  else{
    themeLink.setAttribute("href","lightstyle.css");
    image.setAttribute("src", "lightthemeicon.png");
    btn.innerText = "🌙";
  }
  
  // Save logo state to localStorage
  localStorage.setItem('logo', image.getAttribute("src"));
  localStorage.setItem('theme', themeLink.getAttribute("href"));
}
document.getElementById("darkModeToggle").addEventListener("click", toggleTheme);

// RATIO CHANGE
select.onchange = () => { 
  let [w,h] = select.value.split("x");
  statusBox.style.width = (w/4)+ "px";
  statusBox.style.height = (h/4) + "px";
};

// FONT FAMILY
const fontSelect = document.getElementById("fontSelect");
fontSelect.addEventListener("change", () => {
  const selectedFont = fontSelect.value;
  statusText.style.fontFamily = selectedFont;
});

// TEXT COLOR
function setcolor(){
  statusText.style.color = txtcolor.value;
  document.getElementById("txtcolz").style.backgroundColor = txtcolor.value;
}
txtcolor.addEventListener("input",setcolor);

// BACKGROUND COLOR
function backgcolz(){
  statusBox.style.backgroundColor = backgcol.value;
  document.getElementById("bckgcolz").style.backgroundColor = backgcol.value;
}
backgcol.addEventListener("input",backgcolz);

// BACKGROUND IMAGE
function backgImg(){
  const file = backimg.files[0];
  statusBox.style.backgroundColor = "rgba(8, 8, 8, 0)";
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function () {
    statusBox.style.backgroundImage = `url("${reader.result}")`;
  }
  reader.readAsDataURL(file);
}
backimg.addEventListener("change",backgImg);
backimg.addEventListener("change", backgcolz);

// SET DEFAULT WHATSAPP RATIO
document.addEventListener('DOMContentLoaded', () => {
  if (select) {
    select.value = "1080x1920";
    select.dispatchEvent(new Event('change'));
  }
});

// GRADIENT BACKGROUND
function applyGradient() {
  const selectedGradient = gradientSelect.value;
  if (selectedGradient === "none") {
    statusBox.style.backgroundImage = "none";
  } else if (selectedGradient === "radial") {
    statusBox.style.backgroundImage = `radial-gradient(circle, ${backgcol.value}, ${txtcolor.value})`;
  } else {
    statusBox.style.backgroundImage = `linear-gradient(${selectedGradient}, ${backgcol.value}, ${txtcolor.value})`;
  }
}
gradientSelect.addEventListener("change", applyGradient);
backgcol.addEventListener("input", applyGradient);
txtcolor.addEventListener("input", applyGradient);
applyGradient();

// IMPORTING IMAGES
function getImage(){
  // Check internet connection first
  if (!navigator.onLine) {
    showNoInternetPopup();
    return;
  }
  
  const [width, height] = (select.value || "1080x1920").split("x");
  const url = `https://picsum.photos/${width}/${height}?${Date.now()}`;
  const img = new Image();
  img.crossOrigin = 'anonymous';
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
     // statusBox.style.backgroundColor = 'transparent';
      localStorage.setItem('bgImageData', dataUrl);
      localStorage.removeItem('bgImageUrl');
    } catch (e) {
      statusBox.style.backgroundImage = `url("${url}")`;
      statusBox.style.backgroundSize = 'cover';
      statusBox.style.backgroundPosition = 'center';
      statusBox.style.backgroundRepeat = 'no-repeat';
      //statusBox.style.backgroundColor = 'none';
    }
  };
  img.src = url;
}

// POPUP FUNCTIONS
function showDownloadProgressPopup() {
  const popup = document.createElement('div');
  popup.id = 'downloadProgressPopup';
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  popup.style.color = 'white';
  popup.style.padding = '30px';
  popup.style.borderRadius = '15px';
  popup.style.zIndex = '10000';
  popup.style.textAlign = 'center';
  popup.style.minWidth = '300px';
  popup.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.2)';
  
  popup.innerHTML = `
    <h3 style="margin-bottom: 20px; color: #25D366;">🔄 Generating Your Status</h3>
    <div style="margin-bottom: 20px;">
      <div style="width: 100%; background-color: #333; border-radius: 10px; overflow: hidden;">
        <div id="progressBar" style="height: 8px; background-color: #25D366; width: 0%; transition: width 0.3s;"></div>
      </div>
      <p id="progressText" style="margin-top: 10px; font-size: 14px;">Preparing image...</p>
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
  if (popup) {
    document.body.removeChild(popup);
  }
}

function showNoInternetPopup() {
  const popup = document.createElement('div');
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  popup.style.color = 'white';
  popup.style.padding = '30px';
  popup.style.borderRadius = '15px';
  popup.style.zIndex = '10000';
  popup.style.textAlign = 'center';
  popup.style.minWidth = '300px';
  popup.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.3)';
  
  popup.innerHTML = `
    <h3 style="margin-bottom: 20px; color: #ff4444;">🌐 No Internet Connection</h3>
    <p style="margin-bottom: 20px;">Please check your internet connection and try again.</p>
    <button onclick="this.parentElement.remove()" style="background: #ff4444; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
      OK
    </button>
  `;
  
  document.body.appendChild(popup);
}

// ✅ IMPROVED STATUS IMAGE DOWNLOAD FUNCTION - BRIGHTER IMAGES
function downloadImage() {
  // Check internet connection for web images
  const computedStyle = window.getComputedStyle(statusBox);
  if (computedStyle.backgroundImage.includes('url("http') && !navigator.onLine) {
    showNoInternetPopup();
    return;
  }

  const downloadBtn = document.getElementById('downloadBtn');
  const originalText = downloadBtn.textContent;

  const [wStr, hStr] = (select.value || "1080x1920").split("x");
  const targetW = parseInt(wStr, 10);
  const targetH = parseInt(hStr, 10);
  if (!targetW || !targetH) return;

  downloadBtn.textContent = 'downloading...';
  downloadBtn.disabled = true;

  // Show progress popup
  const progressPopup = showDownloadProgressPopup();
  updateDownloadProgress(10, 'Initializing download...');

  // Container for offscreen rendering
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = targetW + 'px';
  container.style.height = targetH + 'px';
  container.style.overflow = 'hidden';

  // Clone statusBox
  const clone = statusBox.cloneNode(true);
  clone.style.width = targetW + 'px';
  clone.style.height = targetH + 'px';
  clone.style.minWidth = targetW + 'px';
  clone.style.minHeight = targetH + 'px';
  clone.style.maxWidth = targetW + 'px';
  clone.style.maxHeight = targetH + 'px';
  clone.style.backgroundSize = 'cover';
  clone.style.backgroundPosition = 'center';
  //clone.style.backgroundColor = "none";
  clone.style.backgroundRepeat = 'no-repeat';
  clone.style.margin = '0';
  clone.style.padding = '0';
  clone.style.boxSizing = 'border-box';
//  clone.style.opacity = '0.1';  //Ensure rendering
 // clone.style.filter = 'brightness(1.19) contrast(1.1)'; // Make image brighter

  // Scale text properly
  const originalWidth = statusBox.offsetWidth;
  const scaleFactor = targetW / originalWidth;
  const cloneText = clone.querySelector('.editable-text');
  if (cloneText) {
    const currentFontSize = parseFloat(window.getComputedStyle(statusText).fontSize);
    const currentFontWeight = window.getComputedStyle(statusText).fontWeight;
    
    cloneText.style.fontSize = (currentFontSize * scaleFactor) + 'px';
    cloneText.style.fontWeight = currentFontWeight;
    cloneText.style.width = '100%';
    cloneText.style.textAlign = 'center';
    cloneText.style.wordWrap = 'break-word';
   // cloneText.style.backgroundColor = 'none';
    cloneText.style.padding = (20 * scaleFactor) + 'px';
  //  cloneText.style.filter = 'brightness(1.2)'; // Make text slightly brighter
  //  clone.style.opacity = '0.1'; // Further ensure rendering
  }

  container.appendChild(clone);
  document.body.appendChild(container);

  updateDownloadProgress(30, 'Rendering image...');

  // Add a small delay to ensure everything is properly rendered
  setTimeout(() => {
    updateDownloadProgress(60, 'Finalizing image quality...');
    
    // Render container (not just clone) with better quality settings
    html2canvas(container, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: null,
      width: targetW,
      height: targetH,
      scale: 4,
      logging: false,
      // Enhanced settings for brighter images
      onclone: function(clonedDoc, element) {
        // Ensure all styles are properly applied in the clone
        element.style.width = targetW + 'px';
        element.style.height = targetH + 'px';
        element.style.backgroundSize = 'cover';
        element.style.backgroundPosition = 'center';
       // element.style.filter = 'brightness(1.15) contrast(1.1)';
      }
    }).then(canvas => {
      updateDownloadProgress(90, 'Preparing download...');
      
      // Small delay to ensure progress is visible
      setTimeout(() => {
        document.body.removeChild(container);
        
        const link = document.createElement('a');
        link.download = `whatsapp-status-${targetW}x${targetH}-${Date.now()}.jpeg`;
        link.href = canvas.toDataURL('image/jpeg', 1.0); // Maximum quality
        link.click();

        updateDownloadProgress(100, 'Download complete!');
        
        // Hide popup after a short delay
        setTimeout(() => {
          hideDownloadProgressPopup();
          downloadBtn.textContent = originalText;
          downloadBtn.disabled = false;
        }, 1000);
        
      }, 500);
      
    }).catch(err => {
      document.body.removeChild(container);
      hideDownloadProgressPopup();
      console.error('Error generating image:', err);
      alert('Failed to download image. Please try again.');
      downloadBtn.textContent = originalText;
      downloadBtn.disabled = false;
    });
  }, 500);
}

document.getElementById("downloadBtn").addEventListener("click", downloadImage);

// SHARING TO WHATSAPP
const share = document.getElementById("copyBtn");
const link = "https://wa.me/?text=";
share.addEventListener("click", ()=>{
  const text = encodeURIComponent("hi there, I just created a cool WhatsApp status using this awesome Status Maker app! Check it out:https://jhaystatsnap.vercel.app");
  const url = link + text;
  window.open(url, "_blank");
});

// PERSIST STATE TO LOCALSTORAGE
document.addEventListener('DOMContentLoaded', () => {
  try {
    const linkEl = document.getElementById('theme');
    const darkBtn = document.getElementById('darkModeToggle');
    const fontSel = document.getElementById('fontSelect');
    const image = document.getElementById("logo");

    // RESTORE LOGO STATE
    const savedLogo = localStorage.getItem('logo');
    if (savedLogo && image) {
      image.setAttribute("src", savedLogo);
    }

    // RESTORE FONT SIZE
    const savedFontSize = localStorage.getItem('fontSize');
    if (savedFontSize && fontSize) {
      fontSize.value = savedFontSize;
      updateFontSize();
    }

    // RESTORE FONT WEIGHT
    const savedFontWeight = localStorage.getItem('fontWeight');
    if (savedFontWeight && fontWeight) {
      fontWeight.value = savedFontWeight;
      updateFontWeight();
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && linkEl) {
      linkEl.href = savedTheme;
      if (darkBtn) darkBtn.innerText = savedTheme.includes('darkstyle') ? '☀️' : '🌙';
    }

    const savedRatio = localStorage.getItem('screenratio');
    if (savedRatio && select) {
      select.value = savedRatio;
      select.dispatchEvent(new Event('change'));
    }

    const savedFont = localStorage.getItem('fontSelect');
    if (savedFont && fontSel) {
      fontSel.value = savedFont;
      statusText.style.fontFamily = savedFont;
    }

    const savedTxtColor = localStorage.getItem('txtcolor');
    if (savedTxtColor && txtcolor) {
      txtcolor.value = savedTxtColor;
      setcolor();
    }

    const savedBkg = localStorage.getItem('bkgcol');
    if (savedBkg && backgcol) {
      backgcol.value = savedBkg;
      backgcolz();
    }

    const savedGradient = localStorage.getItem('gradientSelect');
    if (savedGradient && gradientSelect) {
      gradientSelect.value = savedGradient;
      applyGradient();
    }

    const savedStatus = localStorage.getItem('statusText');
    if (savedStatus && statusText) {
      statusText.textContent = savedStatus;
    }

    const bgData = localStorage.getItem('bgImageData');
    if (bgData) {
      statusBox.style.backgroundImage = `url("${bgData}")`;
      statusBox.style.backgroundSize = 'cover';
      statusBox.style.backgroundPosition = 'center';
      statusBox.style.backgroundRepeat = 'no-repeat';
      statusBox.style.backgroundColor = 'transparent';
    }

    if (select) {
      select.addEventListener('change', () => {
        localStorage.setItem('screenratio', select.value);
      });
    }

    if (fontSel) {
      fontSel.addEventListener('change', () => {
        localStorage.setItem('fontSelect', fontSel.value);
      });
    }

    if (txtcolor) {
      txtcolor.addEventListener('input', () => {
        localStorage.setItem('txtcolor', txtcolor.value);
      });
    }

    if (backgcol) {
      backgcol.addEventListener('input', () => {
        localStorage.setItem('bkgcol', backgcol.value);
      });
    }

    if (gradientSelect) {
      gradientSelect.addEventListener('change', () => {
        localStorage.setItem('gradientSelect', gradientSelect.value);
      });
    }

    if (statusText) {
      statusText.addEventListener('input', () => {
        const txt = (statusText.innerText || statusText.textContent || '').replace(/\u200B/g, '').trim();
        localStorage.setItem('statusText', txt);
      });
    }

    if (backimg) {
      backimg.addEventListener('change', () => {
        const file = backimg.files && backimg.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            localStorage.setItem('bgImageData', reader.result);
            localStorage.removeItem('bgImageUrl');
          } catch (e) {
            console.warn('Could not save image to localStorage (file too large).', e);
          }
        };
        reader.readAsDataURL(file);
      });
    }

    if (darkBtn && linkEl) {
      darkBtn.addEventListener('click', () => {
        try {
          localStorage.setItem('theme', linkEl.getAttribute('href') || 'lightstyle.css');
          localStorage.setItem('logo', image.getAttribute("src"));
        } catch (e) {
          console.warn('Could not save theme preference', e);
        }
      });
    }
  } catch (err) {
    console.error('State persistence error:', err);
  }
});
