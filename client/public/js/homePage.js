// Redireciona para o login (header e hero)
document.querySelectorAll('.home-login-cta').forEach((btn) => {
  btn.addEventListener('click', function(event) {
    event.preventDefault();
    window.location.href = '../views/login.html';
  });
});

// Navegação suave ao clicar nos links de navegação
const navLinks = document.querySelectorAll(".nav-link");
navLinks.forEach(link => {
  link.addEventListener("click", function(event) {
    const href = this.getAttribute("href");
    
    if (href && href.startsWith("#")) {
      event.preventDefault();
      const targetId = href.substring(1);
      const targetSection = document.getElementById(targetId);

      if (targetSection) {
        targetSection.scrollIntoView({ behavior: "smooth" });
        
        const mobileMenu = document.getElementById('mainNav');
        const mobileToggle = document.getElementById('mobileMenuToggle');
        if (mobileMenu && mobileMenu.classList.contains('active')) {
          mobileMenu.classList.remove('active');
          if (mobileToggle) mobileToggle.classList.remove('active');
        }
      }
    }
  });
});

// Menu hambúrguer para mobile
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mainNav = document.getElementById('mainNav');

if (mobileMenuToggle && mainNav) {
  mobileMenuToggle.addEventListener('click', function() {
    this.classList.toggle('active');
    mainNav.classList.toggle('active');
  });

  // Fechar menu ao clicar fora dele
  document.addEventListener('click', function(event) {
    const isClickInsideNav = mainNav.contains(event.target);
    const isClickOnToggle = mobileMenuToggle.contains(event.target);
    
    if (!isClickInsideNav && !isClickOnToggle && mainNav.classList.contains('active')) {
      mainNav.classList.remove('active');
      mobileMenuToggle.classList.remove('active');
    }
  });
}

// Header landing: transparente no topo, branco ao rolar
function updateLandingHeaderScroll() {
  const header = document.querySelector('.main-header.main-header--landing');
  if (!header) return;
  if (window.scrollY > 8) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
}

window.addEventListener('scroll', updateLandingHeaderScroll, { passive: true });
document.addEventListener('DOMContentLoaded', updateLandingHeaderScroll);

// Animação de entrada para elementos quando visíveis (Intersection Observer)
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

// Observar elementos que devem animar ao entrar na viewport
document.addEventListener('DOMContentLoaded', function() {
  const animatedElements = document.querySelectorAll('.feature-item, .how-it-works-item, .card, .oncology-panel, .feature-card, .hp-testimonial-card, .hp-final-cta, .benefit-item, .hp-wearables-inner');
  
  animatedElements.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
    observer.observe(el);
  });

  const legalDropdown = document.getElementById('legalDropdown');
  if (legalDropdown) {
    const dropdownToggle = legalDropdown.querySelector('.nav-dropdown-toggle');
    
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', function(event) {
        event.preventDefault();
        legalDropdown.classList.toggle('active');
      });
    }

    document.addEventListener('click', function(event) {
      if (!legalDropdown.contains(event.target)) {
        legalDropdown.classList.remove('active');
      }
    });

    const dropdownLinks = legalDropdown.querySelectorAll('.nav-dropdown-link');
    dropdownLinks.forEach(link => {
      link.addEventListener('click', function() {
        legalDropdown.classList.remove('active');
        const mobileMenu = document.getElementById('mainNav');
        const mobileToggle = document.getElementById('mobileMenuToggle');
        if (mobileMenu && mobileMenu.classList.contains('active')) {
          mobileMenu.classList.remove('active');
          if (mobileToggle) mobileToggle.classList.remove('active');
        }
      });
    });
  }
});

function pfWatchGetLang() {
  return typeof window.pulseflowGetLanguage === 'function' ? window.pulseflowGetLanguage() : 'pt-BR';
}

function pfWatchT(key, fallback) {
  return typeof window.pulseflowT === 'function' ? window.pulseflowT(key, { fallback }) : fallback;
}

function pfWatchWeatherKey(code) {
  if (code === 0) return 'homePage.weatherClear';
  if (code === 1) return 'homePage.weatherMainlyClear';
  if (code === 2) return 'homePage.weatherPartlyCloudy';
  if (code === 3) return 'homePage.weatherOvercast';
  if (code >= 45 && code <= 48) return 'homePage.weatherFog';
  if (code >= 51 && code <= 57) return 'homePage.weatherDrizzle';
  if (code >= 61 && code <= 67) return 'homePage.weatherRain';
  if (code >= 71 && code <= 77) return 'homePage.weatherSnow';
  if (code >= 80 && code <= 82) return 'homePage.weatherShowers';
  if (code >= 85 && code <= 86) return 'homePage.weatherSnowShowers';
  if (code >= 95) return 'homePage.weatherThunderstorm';
  return 'homePage.weatherPartlyCloudy';
}

function pfWatchWeatherIconClass(code) {
  if (code === 0) return 'fa-sun';
  if (code <= 2) return 'fa-cloud-sun';
  if (code === 3) return 'fa-cloud';
  if (code >= 45 && code <= 48) return 'fa-smog';
  if (code >= 51 && code <= 57) return 'fa-cloud-rain';
  if (code >= 61 && code <= 67) return 'fa-cloud-showers-heavy';
  if (code >= 71 && code <= 77) return 'fa-snowflake';
  if (code >= 80 && code <= 82) return 'fa-cloud-sun-rain';
  if (code >= 85 && code <= 86) return 'fa-snowflake';
  if (code >= 95) return 'fa-bolt';
  return 'fa-cloud';
}

function initPfWatch() {
  const timeEl = document.getElementById('pfWatchTime');
  const dayEl = document.getElementById('pfWatchDay');
  const weatherEl = document.getElementById('pfWatchWeather');
  const weatherIcon = document.getElementById('pfWatchWeatherIcon');
  if (!timeEl || !dayEl || !weatherEl) return;

  function tick() {
    const now = new Date();
    const locale = pfWatchGetLang() === 'en' ? 'en-US' : 'pt-BR';
    timeEl.textContent = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
    dayEl.textContent = now.toLocaleDateString(locale, { weekday: 'long' }).toUpperCase();
  }
  tick();
  setInterval(tick, 1000);

  weatherEl.textContent = pfWatchT('homePage.watchWeatherLoading', '…');

  if (!navigator.geolocation) {
    weatherEl.textContent = pfWatchT('homePage.watchWeatherUnavailable', '—');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,weather_code&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('weather');
        const data = await res.json();
        const temp = data.current && Math.round(data.current.temperature_2m);
        const code = data.current ? data.current.weather_code : 2;
        const label = pfWatchT(pfWatchWeatherKey(code), '');
        weatherEl.textContent = `${temp}°C · ${label}`;
        if (weatherIcon) {
          weatherIcon.className = `fas ${pfWatchWeatherIconClass(code)} pf-watch__weather-icon`;
        }
      } catch {
        weatherEl.textContent = pfWatchT('homePage.watchWeatherUnavailable', '—');
      }
    },
    () => {
      weatherEl.textContent = pfWatchT('homePage.watchWeatherDenied', '—');
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
  );
}

document.addEventListener('pulseflow-i18n-ready', initPfWatch, { once: true });
