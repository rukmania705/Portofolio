/**
 * ==========================================================================
 * PORTFOLIO RUKMANIA — JAVASCRIPT LOGIC
 * Features:
 * 1. Sticky Navbar & Header State
 * 2. Mobile Hamburger Menu Drawer
 * 3. Smooth Scrolling with Nav Offset
 * 4. Scrollspy (Active Navigation Link Highlighting)
 * 5. Scroll Reveal Animation (IntersectionObserver)
 * 6. Lightbox & Video Modal
 * 7. 1-Click Copy Email & Toast Notification
 * 8. Interactive Contact Form with WhatsApp Integration
 * 9. Back to Top Button
 * 10. Dark / Light Theme Toggle with LocalStorage
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- 1. STICKY NAVBAR & SCROLL EFFECT ---
  const header = document.getElementById('header');
  const backToTopBtn = document.getElementById('backToTop');

  function handleScroll() {
    const scrollY = window.scrollY || window.pageYOffset;

    if (header) {
      if (scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    if (backToTopBtn) {
      if (scrollY > 350) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // Initial check

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // --- 2. MOBILE HAMBURGER MENU DRAWER ---
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = hamburger.classList.toggle('active');
      navMenu.classList.toggle('active', isActive);
      document.body.style.overflow = isActive ? 'hidden' : '';
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
      });
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('active') && !navMenu.contains(e.target) && !hamburger.contains(e.target)) {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  // --- 3. ACTIVE NAVIGATION HIGHLIGHTING (SCROLLSPY) ---
  const sections = document.querySelectorAll('section[id]');

  function updateActiveNav() {
    const scrollY = window.scrollY + 120;

    sections.forEach(sec => {
      const secTop = sec.offsetTop;
      const secHeight = sec.offsetHeight;
      const secId = sec.getAttribute('id');

      if (scrollY >= secTop && scrollY < secTop + secHeight) {
        navLinks.forEach(link => {
          if (link.getAttribute('href') === `#${secId}`) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();

  // --- 4. SCROLL REVEAL ANIMATIONS ---
  const revealElements = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));
  } else {
    // Fallback if IntersectionObserver is not supported
    revealElements.forEach(el => el.classList.add('revealed'));
  }

  // --- 5. UNIVERSAL LIGHTBOX MODAL (IMAGES & VIDEOS) ---
  const modal = document.getElementById('lightboxModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalCaption = document.getElementById('modalCaption');
  const modalImg = document.getElementById('modalImg');
  const modalVideo = document.getElementById('modalVideo');
  const modalVideoSource = document.getElementById('modalVideoSource');
  const modalDownload = document.getElementById('modalDownload');
  const modalClose = document.getElementById('modalClose');

  function openLightbox(options) {
    if (!modal) return;
    const { type, src, title, caption } = options;

    if (modalTitle) modalTitle.textContent = title || 'Pratinjau Dokumen';
    if (modalCaption) modalCaption.textContent = caption || '';

    if (type === 'video') {
      if (modalImg) modalImg.style.display = 'none';
      if (modalVideo) {
        modalVideo.style.display = 'block';
        if (modalVideoSource) modalVideoSource.src = src;
        modalVideo.load();
        modalVideo.play().catch(() => {});
      }
    } else {
      if (modalVideo) {
        modalVideo.pause();
        modalVideo.style.display = 'none';
      }
      if (modalImg) {
        modalImg.style.display = 'block';
        modalImg.src = src;
        modalImg.alt = title || 'Gambar Pratinjau';
      }
    }

    if (modalDownload) {
      modalDownload.href = src;
      modalDownload.setAttribute('download', src.split('/').pop() || 'dokumen.jpg');
    }

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (modalVideo) {
      modalVideo.pause();
    }
    setTimeout(() => {
      if (modalImg) modalImg.src = '';
      if (modalVideoSource) modalVideoSource.src = '';
    }, 250);
  }

  document.querySelectorAll('.lightbox-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const type = trigger.getAttribute('data-type') || 'image';
      const src = trigger.getAttribute('data-src') || trigger.getAttribute('data-img');
      const title = trigger.getAttribute('data-title');
      const caption = trigger.getAttribute('data-caption');

      if (src) {
        openLightbox({ type, src, title, caption });
      }
    });
  });

  if (modalClose) modalClose.addEventListener('click', closeLightbox);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeLightbox();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      closeLightbox();
    }
  });

  // --- 6. 1-CLICK EMAIL COPY & TOAST NOTIFICATION ---
  const toast = document.getElementById('toastNotice');
  let toastTimer = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  const copyEmailBtn = document.getElementById('copyEmailBtn');
  if (copyEmailBtn) {
    copyEmailBtn.addEventListener('click', async () => {
      const email = copyEmailBtn.getAttribute('data-email') || 'rukmania705@gmail.com';
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
      } catch (err) {
        showToast('Email: ' + email);
      }
    });
  }

  // --- 7. INTERACTIVE CONTACT FORM ---
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('formName')?.value.trim() || 'Rekan';
      const email = document.getElementById('formEmail')?.value.trim() || '';
      const subject = document.getElementById('formSubject')?.value.trim() || 'Peluang Kerja / Kolaborasi';
      const message = document.getElementById('formMessage')?.value.trim() || '';

      const waText = encodeURIComponent(
        `Halo Rukmania, saya ${name} (${email}).\n\nSubjek: ${subject}\n\nPesan:\n${message}`
      );
      const waUrl = `https://wa.me/6281227254584?text=${waText}`;

      showToast('Mengalihkan ke WhatsApp...');
      setTimeout(() => {
        window.open(waUrl, '_blank');
      }, 600);
    });
  }

  // --- 8. THEME TOGGLE (LIGHT / DARK MODE) ---
  const themeToggle = document.getElementById('themeToggle');
  const storedTheme = localStorage.getItem('rukmania_theme') || 'light';

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rukmania_theme', theme);
  }

  setTheme(storedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      setTheme(nextTheme);
      showToast(nextTheme === 'dark' ? '🌙 Dark Mode aktif' : '☀️ Light Mode aktif');
    });
  }

});
