export default {
  Auth: {
    login: 'Giriş Yap',
    logout: 'Çıkış Yap',
    email: 'E-posta',
    password: 'Şifre',
    loginForm: {
      title: 'Hesabınıza giriş yapın',
      description:
        'Klinik çalışma alanınıza devam etmek için bilgilerinizi kullanın.',
      platformLabel: 'Klinik yönetim platformu',
      heroTitle: 'Klinik operasyonlarınız, tek bir yerde.',
      heroDescription:
        'Hasta ilişkilerinden randevulara ve finans süreçlerine kadar ekibinizin iş akışını kolayca yönetin.',
      terms:
        'Giriş yaparak çalışma alanınızın kullanım koşullarını kabul etmiş olursunuz.',
      footer: 'Güvenli klinik yönetimi için tasarlandı.',
      continueWithGoogle: 'Google ile devam et',
      or: 'veya',
      login: 'Giriş yap',
      email: 'E-posta',
      password: 'Şifre',
      phone: 'Telefon',
      phoneNumber: 'Telefon numarası',
      smsVerificationCode: 'SMS doğrulama kodu',
      countryCode: 'Ülke kodu',
      showPassword: 'Parolayı göster',
      hidePassword: 'Parolayı gizle',
      changePhoneNumber: 'Numarayı değiştir',
      phoneHint: 'Ülke kodu seçilen numaraya otomatik eklenir.',
      sendSmsCode: 'SMS kodu gönder',
      signUpPrompt: 'Hesabınız yok mu?',
      signUp: 'Hemen kaydolun',
      signUpHelp:
        'Hesap oluşturmak için kliniğinizin yöneticisiyle iletişime geçin.',
      validation: {
        email: 'Geçerli bir e-posta adresi gir.',
        password: 'Parola en az 6 karakter olmalı.',
        phone: 'Geçerli bir telefon numarası gir.',
        verificationCode: 'SMS ile gelen 6 haneli kodu gir.',
      },
      errors: {
        invalidCredential: 'E-posta veya parola hatalı.',
        tooManyRequests: 'Çok fazla denendi. Bir süre sonra tekrar dene.',
        network: 'Ağ hatası. Bağlantını kontrol et.',
        popupClosed: 'Google giriş penceresi kapatıldı.',
        popupBlocked: 'Tarayıcı giriş penceresini engelledi. Tekrar dene.',
        invalidPhone: 'Geçerli bir telefon numarası gir.',
        invalidVerificationCode: 'SMS doğrulama kodu hatalı.',
        codeExpired: 'Doğrulama kodunun süresi doldu. Yeni kod iste.',
        quotaExceeded:
          'SMS gönderim sınırına ulaşıldı. Daha sonra tekrar dene.',
        phoneInitialization: 'Telefon doğrulaması başlatılamadı.',
        generic: 'Giriş yapılamadı. Tekrar dene.',
      },
    },
  },
} as const;
