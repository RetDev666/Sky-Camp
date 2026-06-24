import { apiFetch, showToast } from './app.js';

export async function loadGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="empty">Завантаження...</div>';
  
  try {
    const { images } = await apiFetch('/gallery');
    if (!images || !images.length) {
      grid.innerHTML = '<div class="empty" style="grid-column: 1 / -1">Галерея порожня</div>';
      return;
    }
    
    grid.innerHTML = images.map(img => `
      <div class="gallery-item">
        <img src="${img.image_data}" alt="Gallery Image" loading="lazy">
        <button class="gallery-item-delete" onclick="deleteGalleryImage(${img.id})" title="Видалити">
          <span class="material-symbols-outlined" style="font-size:16px">delete</span>
        </button>
      </div>
    `).join('');
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      grid.innerHTML = `<div class="empty">Помилка: ${err.message}</div>`;
    }
  }
}

export async function deleteGalleryImage(id) {
  if (!confirm('Ви дійсно хочете видалити це фото?')) return;
  try {
    const res = await apiFetch(`/gallery/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Фото видалено', 'success');
      loadGallery();
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') showToast(err.message, 'error');
  }
}

export async function uploadGalleryImage(input) {
  const file = input.files[0];
  if (!file) return;
  
  // Compress image
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      const MAX = 1200;
      if (width > height && width > MAX) {
        height *= MAX / width; width = MAX;
      } else if (height > MAX) {
        width *= MAX / height; height = MAX;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // Get webp base64 (quality 0.8)
      const dataUrl = canvas.toDataURL('image/webp', 0.8);
      
      // Upload
      apiFetch('/gallery', {
        method: 'POST',
        body: JSON.stringify({ image_data: dataUrl })
      }).then(res => {
        if (res.ok) {
          showToast('Фото завантажено', 'success');
          loadGallery();
        }
      }).catch(err => {
        if (err.message !== 'Unauthorized') showToast(err.message, 'error');
      }).finally(() => {
        input.value = ''; // reset input
      });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
