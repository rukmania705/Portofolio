/**
 * script.js - Logika Interaktif Portofolio Sederhana Rukmania
 * Fitur:
 * - Modal Pratinjau Dokumen / Sertifikat
 * - Salin Email 1-Klik dengan Notifikasi Toast
 * - Auto-Pause Video lain saat salah satu video diputar
 * - Navigasi Mobile Responsif
 */

document.addEventListener('DOMContentLoaded', () => {

  // 1. NOTIFIKASI TOAST
  const toast = document.getElementById('toast');
  let toastTimeout = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // 2. SALIN EMAIL 1-KLIK
  const copyBtn = document.getElementById('btn-copy-email');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const email = copyBtn.getAttribute('data-copy') || 'rukmania705@gmail.com';
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(email);
        } else {
          const ta = document.createElement('textarea');
          ta.value = email;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        showToast('✓ Email berhasil disalin: ' + email);
      } catch (e) {
        showToast('Email: ' + email);
      }
    });
  }

  // 3. MODAL VIEWER SERTIFIKAT & DOKUMEN
  const modal = document.getElementById('doc-modal');
  const modalImg = document.getElementById('modal-img');
  const modalTitle = document.getElementById('modal-title');
  const modalDownload = document.getElementById('modal-download');
  const modalClose = document.getElementById('modal-close');
  const modalBackdrop = document.getElementById('modal-backdrop');

  function openModal(imgSrc, titleText) {
    if (!modal || !modalImg) return;
    modalImg.src = imgSrc;
    if (modalTitle) modalTitle.textContent = titleText || 'Pratinjau Dokumen';
    if (modalDownload) {
      modalDownload.href = imgSrc;
      modalDownload.setAttribute('download', imgSrc.split('/').pop() || 'dokumen.jpg');
    }
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => {
      if (modalImg) modalImg.src = '';
    }, 200);
  }

  document.querySelectorAll('.view-doc-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const img = btn.getAttribute('data-img');
      const title = btn.getAttribute('data-title');
      if (img) openModal(img, title);
    });
  });

  modalClose?.addEventListener('click', closeModal);
  modalBackdrop?.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('active')) {
      closeModal();
    }
  });

  // 4. AUTO-PAUSE VIDEO (Mencegah dua video bersuara bersamaan)
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    video.addEventListener('play', () => {
      videos.forEach(otherVideo => {
        if (otherVideo !== video && !otherVideo.paused) {
          otherVideo.pause();
        }
      });
    });
  });

  // 5. NAVIGASI MOBILE SEDERHANA
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const isVisible = navMenu.style.display === 'flex';
      navMenu.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        navMenu.style.flexDirection = 'column';
        navMenu.style.position = 'absolute';
        navMenu.style.top = '70px';
        navMenu.style.left = '0';
        navMenu.style.width = '100%';
        navMenu.style.background = '#FFFFFF';
        navMenu.style.padding = '20px';
        navMenu.style.borderBottom = '1px solid #E2E8F0';
        navMenu.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.08)';
        navMenu.style.gap = '16px';
      }
    });

    // Sembunyikan menu saat link diklik
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          navMenu.style.display = 'none';
        }
      });
    });
  }

});
