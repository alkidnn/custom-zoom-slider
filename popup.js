const slider = document.getElementById('zoomSlider');
const numberInput = document.getElementById('zoomNumber');
const resetBtn = document.getElementById('resetBtn');
const siteDomainDiv = document.getElementById('siteDomain');
const zoomDownBtn = document.getElementById('zoomDown');
const zoomUpBtn = document.getElementById('zoomUp');

let currentDomain = '';
let isUpdating = false; // Защита от зацикливания

// Получаем домен из URL
function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return '';
  }
}

// Применяем масштаб к вкладке (через CSS, без всплывающего окна Chrome)
function updateZoom(value) {
  if (isUpdating) return;
  isUpdating = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) {
      isUpdating = false;
      return;
    }
    const tab = tabs[0];
    
    // Защита от служебных страниц
    if (tab.url.startsWith('chrome://')) {
      isUpdating = false;
      return;
    }

    // Вместо setZoom используем CSS-масштаб через scripting
    const zoomPercent = value / 100;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (zoom) => {
        document.body.style.zoom = zoom;
        if (!document.body.style.zoom) {
          document.documentElement.style.zoom = zoom;
        }
      },
      args: [zoomPercent]
    }, () => {
      isUpdating = false;
    });

    // Сохраняем в память
    if (currentDomain) {
      chrome.storage.local.set({ [currentDomain]: value });
    }
  });
}

// Загрузка при открытии попапа
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs || !tabs[0]) return;
  const tab = tabs[0];
  
  // Блокировка на служебных страницах
  if (tab.url.startsWith('chrome://')) {
    siteDomainDiv.textContent = "Не поддерживается на страницах Chrome";
    slider.disabled = true;
    numberInput.disabled = true;
    resetBtn.disabled = true;
    zoomDownBtn.disabled = true;
    zoomUpBtn.disabled = true;
    return;
  }

  currentDomain = getDomain(tab.url);
  siteDomainDiv.textContent = currentDomain ? `Сайт: ${currentDomain}` : "Не поддерживается";

  if (currentDomain) {
    // Сначала проверяем сохраненное значение
    chrome.storage.local.get([currentDomain], (result) => {
      if (result[currentDomain]) {
        const savedZoom = result[currentDomain];
        applyValuesToUI(savedZoom);
        const zoomPercent = savedZoom / 100;
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (zoom) => {
            document.body.style.zoom = zoom;
            if (!document.body.style.zoom) {
              document.documentElement.style.zoom = zoom;
            }
          },
          args: [zoomPercent]
        });
      } else {
        applyValuesToUI(100);
      }
    });
  }
});

// Синхронизация ползунка и числа
function applyValuesToUI(value) {
  isUpdating = true;
  slider.value = value;
  numberInput.value = value;
  isUpdating = false;
}

// Слайдер
slider.addEventListener('input', (e) => {
  const value = parseInt(e.target.value);
  numberInput.value = value;
  updateZoom(value);
});

// Поле ввода числа
numberInput.addEventListener('input', (e) => {
  let value = parseInt(e.target.value);
  if (isNaN(value) || value < 1) {
    value = 1;
  } else if (value > 500) {
    value = 500;
  }

  if (value > 300) {
    slider.max = 500;
  } else {
    slider.max = 300;
  }

  slider.value = value;
  updateZoom(value);
});

// Кнопка сброса
resetBtn.addEventListener('click', () => {
  applyValuesToUI(100);
  updateZoom(100);
});

// Кнопка − (минус)
zoomDownBtn.addEventListener('click', () => {
  let val = parseInt(numberInput.value);
  if (isNaN(val) || val < 10) val = 10;
  val = Math.max(10, val - 1); // шаг 1%
  numberInput.value = val;
  slider.value = val;
  updateZoom(val);
});

// Кнопка + (плюс)
zoomUpBtn.addEventListener('click', () => {
  let val = parseInt(numberInput.value);
  if (isNaN(val)) val = 100;
  val = Math.min(500, val + 1); // шаг 1%
  numberInput.value = val;
  slider.value = val;
  updateZoom(val);
});