const select = document.getElementById("screenratio");
const statusBox = document.querySelector(".status-box");
const txtcolor = document.getElementById("txtcol")
const statusText = document.querySelector(".editable-text")
const backgcol = document.getElementById("bkgcol")
const backimg = document.getElementById("backimg")
const gradientSelect = document.getElementById("gradientSelect");


//dark theme toggle javascript
function toggleTheme(){
  const themeLink = document.getElementById("theme");
  const currentTheme = themeLink.getAttribute("href");
  const image = document.getElementById("logo")
  const currentImage = image.getAttribute("src");
  const btn = document.getElementById("darkModeToggle")

  if (currentTheme === "lightstyle.css"){
    themeLink.setAttribute("href","darkstyle.css");
    image.setAttribute("src", "darkthemeicon.png")
    btn.innerText = "☀️"
  }
  else{
    themeLink.setAttribute("href","lightstyle.css");
    image.setAttribute("src", "lightthemeicon.png")
    btn.innerText = "🌙"
  }
  }
  
  document.getElementById("darkModeToggle").addEventListener("click", toggleTheme);


  select.onchange = () => { let [w,h] = select.value.split("x");
    statusBox.style.width = (w/4)+ "px";
    statusBox.style.height = (h/4) + "px";
    
  }

  //FONT FAMILY SELECTION
  
  const fontSelect = document.getElementById("fontSelect");

  fontSelect.addEventListener("change", () => {
    const selectedFont = fontSelect.value;
    statusText.style.fontFamily = selectedFont;
  });

  //STATUS TEXT

  function setcolor(){
    statusText.style.color = txtcolor.value;
    document.getElementById("txtcolz").style.backgroundColor = txtcolor.value;
  }

  txtcolor.addEventListener("input",setcolor)

  //BACKGROUND COLOR

  function backgcolz(){
    statusBox.style.backgroundColor = backgcol.value
    document.getElementById("bckgcolz").style.backgroundColor = backgcol.value
  }

  backgcol.addEventListener("input",backgcolz)

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

  backimg.addEventListener("change",backgImg)
  backimg.addEventListener("change", backgcolz)


// set WhatsApp (9:16) ratio by default when page loads
document.addEventListener('DOMContentLoaded', () => {
  if (select) {
    select.value = "1080x1920";
    // trigger the onchange handler
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

// INITIAL GRADIENT APPLICATION
applyGradient();

// IMPORTING IMAGES - fixed
function getImage(){
  const [width, height] = (select.value || "1080x1920").split("x");
  const url = `https://picsum.photos/${width}/${height}?${Date.now()}`; // prevent caching

  // preload to avoid flicker / broken background
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    // Convert image to base64 to ensure it persists and doesn't regenerate
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    
    // Use high quality image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0);
    
    try {
      // Use JPEG with high quality for better compression and quality
      const dataUrl = canvas.toDataURL('image/jpeg');
      
      // Apply to status box
      statusBox.style.backgroundImage = `url("${dataUrl}")`;
      statusBox.style.backgroundSize = 'cover';
      statusBox.style.backgroundPosition = 'center';
      statusBox.style.backgroundRepeat = 'no-repeat';
      statusBox.style.backgroundColor = 'transparent';
      
      // Save the base64 data to localStorage (not the URL)
      localStorage.setItem('bgImageData', dataUrl);
      localStorage.removeItem('bgImageUrl');
    } catch (e) {
      console.warn('Could not save image to localStorage', e);
      // Fallback: just set the image without saving
      statusBox.style.backgroundImage = `url("${url}")`;
      statusBox.style.backgroundSize = 'cover';
      statusBox.style.backgroundPosition = 'center';
      statusBox.style.backgroundRepeat = 'no-repeat';
      statusBox.style.backgroundColor = 'transparent';
    }
  };
  img.onerror = () => {
    console.error('Failed to load image from', url);
    alert('Failed to import image. Please try again.');
  };
  img.src = url;
}

// STATUS IMAGE DOWNLOAD (fixed: produce full-size image)
// STATUS IMAGE DOWNLOAD (fixed: produce full-size high quality image)
function downloadImage() {
  const downloadBtn = document.getElementById('downloadBtn');
  const originalText = downloadBtn.textContent;
  
  const [wStr, hStr] = (select.value).split("x");
  const targetW = parseInt(wStr, 10);
  const targetH = parseInt(hStr, 10);
  if (!targetW || !targetH) return;

  // Show loading state
  downloadBtn.textContent = 'downloading...';
  downloadBtn.disabled = true;

  // Create a new container for the high-resolution render
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = targetW + 'px';
  container.style.height = targetH + 'px';
  container.style.zIndex = '9999';
  container.style.overflow = 'hidden';
  
  // Clone the status box with full target dimensions
  const clone = statusBox.cloneNode(true);
  clone.style.width = targetW + 'px';
  clone.style.height = targetH + 'px';
  clone.style.backgroundSize = 'cover';
  clone.style.backgroundPosition = 'center';
  clone.style.backgroundRepeat = 'no-repeat';
  clone.style.transform = 'none';
  clone.style.boxShadow = 'none';
  clone.style.animation = 'none';
  clone.style.borderRadius = '0';
  clone.style.border = 'none';
  clone.style.padding = '0';
  clone.style.margin = '0';
  clone.style.display = 'flex';
  clone.style.justifyContent = 'center';
  clone.style.alignItems = 'center';
  clone.style.position = 'relative';
  
  // Copy all computed styles for accurate rendering
  const computedStyle = window.getComputedStyle(statusBox);
  clone.style.backgroundImage = computedStyle.backgroundImage;
  clone.style.backgroundColor = computedStyle.backgroundColor;
  clone.style.backgroundSize = computedStyle.backgroundSize;
  clone.style.backgroundPosition = computedStyle.backgroundPosition;
  
  // Scale text properly for the full-size image
  const cloneText = clone.querySelector('.editable-text');
  if (cloneText) {
    const currentWidth = statusBox.offsetWidth;
    const scaleFactor = targetW / currentWidth;
    const currentFontSize = parseFloat(window.getComputedStyle(statusText).fontSize);
    const scaledFontSize = currentFontSize * scaleFactor;
    
    cloneText.style.color = computedStyle.color;
    cloneText.style.fontFamily = computedStyle.fontFamily;
    cloneText.style.fontSize = scaledFontSize + 'px';
    cloneText.style.fontWeight = computedStyle.fontWeight;
    cloneText.style.fontStyle = computedStyle.fontStyle;
    cloneText.style.textAlign = 'center';
    cloneText.style.width = '100%';
    cloneText.style.wordWrap = 'break-word';
    cloneText.style.padding = (20 * scaleFactor) + 'px';
    cloneText.style.lineHeight = computedStyle.lineHeight;
    cloneText.style.letterSpacing = computedStyle.letterSpacing;
    cloneText.style.textShadow = computedStyle.textShadow;
  }
  
  container.appendChild(clone);
  document.body.appendChild(container);

  // Use higher scale for better quality - scale 3 for ultra HD
  const scale = 3;

  html2canvas(clone, {
    useCORS: true,
    allowTaint: false,
    width: targetW,
    height: targetH,
    scale: scale,
    backgroundColor: null,
    logging: false,
    imageTimeout: 15000,
    removeContainer: true,
    onclone: function(clonedDoc) {
      // Ensure the cloned element has proper styles
      const clonedElement = clonedDoc.querySelector('.status-box');
      if (clonedElement) {
        clonedElement.style.width = targetW + 'px';
        clonedElement.style.height = targetH + 'px';
      }
    }
  }).then(canvas => {
    // Remove container
    document.body.removeChild(container);
    
    // Create download link with high quality PNG
    const link = document.createElement('a');
    link.download = `whatsapp-status-${targetW}x${targetH}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0); // Maximum quality
    link.click();
    
    // Restore button state
    downloadBtn.textContent = originalText;
    downloadBtn.disabled = false;
  }).catch(err => {
    // Remove container on error
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
    console.error('Error generating image:', err);
    alert('Failed to download image. Please try again.');
    
    // Restore button state
    downloadBtn.textContent = originalText;
    downloadBtn.disabled = false;
  });
}
document.getElementById("downloadBtn").addEventListener("click", downloadImage);

//SHARING TO WHATSAPP
const share = document.getElementById("copyBtn");
const link = "https://wa.me/?text=";

share.addEventListener("click", ()=>{
  const text = encodeURIComponent("hi there, I just created a cool WhatsApp status using this awesome Status Maker app! Check it out:https://jhaystatsnap.vercel.app");
  const url = link + text;
  window.open(url, "_blank");
});

/* Persist UI state to localStorage and restore on load */
document.addEventListener('DOMContentLoaded', () => {
  try {
    const linkEl = document.getElementById('theme');
    const darkBtn = document.getElementById('darkModeToggle');
    const fontSel = document.getElementById('fontSelect');

    // RESTORE saved settings
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

    // Restore background image (uploaded file or imported image)
    const bgData = localStorage.getItem('bgImageData');
    
    if (bgData) {
      statusBox.style.backgroundImage = `url("${bgData}")`;
      statusBox.style.backgroundSize = 'cover';
      statusBox.style.backgroundPosition = 'center';
      statusBox.style.backgroundRepeat = 'no-repeat';
      statusBox.style.backgroundColor = 'transparent';
    }

    // SAVE settings on user interactions
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

    // Save uploaded image to localStorage
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

    // Persist theme toggle
    if (darkBtn && linkEl) {
      darkBtn.addEventListener('click', () => {
        try {
          localStorage.setItem('theme', linkEl.getAttribute('href') || 'lightstyle.css');
        } catch (e) {
          console.warn('Could not save theme preference', e);
        }
      });
    }
  } catch (err) {
    console.error('State persistence error:', err);
  }
});
