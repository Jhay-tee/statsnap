const select = document.getElementById("screenratio");
const statusBox = document.querySelector(".status-box");
const txtcolor = document.getElementById("txtcol");
const statusText = document.querySelector(".editable-text");
const backgcol = document.getElementById("bkgcol");
const backimg = document.getElementById("backimg");
const gradientSelect = document.getElementById("gradientSelect");

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
      statusBox.style.backgroundColor = 'transparent';
      localStorage.setItem('bgImageData', dataUrl);
      localStorage.removeItem('bgImageUrl');
    } catch (e) {
      statusBox.style.backgroundImage = `url("${url}")`;
      statusBox.style.backgroundSize = 'cover';
      statusBox.style.backgroundPosition = 'center';
      statusBox.style.backgroundRepeat = 'no-repeat';
      statusBox.style.backgroundColor = 'transparent';
    }
  };
  img.src = url;
}

// ✅ FIXED STATUS IMAGE DOWNLOAD
function downloadImage() {
  const downloadBtn = document.getElementById('downloadBtn');
  const originalText = downloadBtn.textContent;

  const [wStr, hStr] = (select.value || "1080x1920").split("x");
  const targetW = parseInt(wStr, 10);
  const targetH = parseInt(hStr, 10);
  if (!targetW || !targetH) return;

  downloadBtn.textContent = 'downloading...';
  downloadBtn.disabled = true;

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
  clone.style.backgroundColor = "none";
  clone.style.backgroundRepeat = 'no-repeat';
  clone.style.margin = '0';
  clone.style.padding = '0';
  clone.style.boxSizing = 'border-box';
  clone.style.opacity = '1';

  // Scale text properly
  const originalWidth = statusBox.offsetWidth;
  const scaleFactor = targetW / originalWidth;
  const cloneText = clone.querySelector('.editable-text');
  if (cloneText) {
    const currentFontSize = parseFloat(window.getComputedStyle(statusText).fontSize);
    cloneText.style.fontSize = (currentFontSize * scaleFactor) + 'px';
    cloneText.style.width = '100%';
    cloneText.style.textAlign = 'center';
    cloneText.style.wordWrap = 'break-word';
    cloneText.style.backgroundColor = 'none';
    cloneText.style.padding = (20 * scaleFactor) + 'px';
    clone.style.opacity = '1';
  }

  container.appendChild(clone);
  document.body.appendChild(container);

  // Render container (not just clone)
  html2canvas(container, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
    width: targetW,
    height: targetH,
    scale:  4,
    logging: false
  }).then(canvas => {
    document.body.removeChild(container);

    const link = document.createElement('a');
    link.download = `whatsapp-status-${targetW}x${targetH}-${Date.now()}.jpeg`;
    link.href = canvas.toDataURL('image/jpeg', 1.0);
    link.click();

    downloadBtn.textContent = originalText;
    downloadBtn.disabled = false;
  }).catch(err => {
    document.body.removeChild(container);
    console.error('Error generating image:', err);
    alert('Failed to download image. Please try again.');
    downloadBtn.textContent = originalText;
    downloadBtn.disabled = false;
  });
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

// PERSIST STATE TO LOCALSTORAGE (unchanged, left as in your code)
document.addEventListener('DOMContentLoaded', () => {
  try {
    const linkEl = document.getElementById('theme');
    const darkBtn = document.getElementById('darkModeToggle');
    const fontSel = document.getElementById('fontSelect');

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
        } catch (e) {
          console.warn('Could not save theme preference', e);
        }
      });
    }
  } catch (err) {
    console.error('State persistence error:', err);
  }
});
