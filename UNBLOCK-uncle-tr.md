# Mahmut Celayir — İlk açılış rehberi (Sequoia için)

## ⚡ Hızlı yol (Terminal — 30 saniye)

Bu macOS 15 (Sequoia) için en güvenilir çözüm.

1. **DMG'yi aç**, içindeki uygulamayı **Applications** klasörüne sürükle
2. Spotlight'ı aç (üstte küçük büyüteç ikonu veya Cmd ⌘ + boşluk)
3. **"Terminal"** yazıp Return'e bas (Terminal uygulaması açılır)
4. Aşağıdaki tek satırı **kopyala** ve Terminal'e **yapıştır**, sonra Return'e bas:

```
xattr -cr "/Applications/Mahmut Celayir.app" && open "/Applications/Mahmut Celayir.app"
```

5. Terminal hiçbir şey yazmazsa **başarılı** demektir. Uygulama açılacak.
6. Bir uyarı çıkarsa → **"Aç"** / **"Open"** butonuna bas
7. Bir kez yaptıktan sonra normal çift tıklamayla her zaman açılır

> Bu komut zararsız. Sadece "İnternet'ten geldi" işaretini siliyor — Apple tarafından konuluyor, uygulamada bir sorun yok.

---

## 🪟 Alternatif yol (Sistem Ayarları — Terminal'siz)

Terminal'i açmak istemiyorsan bu yolu izle. Biraz daha uzun ama tamamen GUI.

### 1. Adım: Uygulamayı Applications'a koy

DMG'yi aç, uygulamayı **Applications** klasörüne sürükle. Sonra DMG penceresini kapat.

### 2. Adım: Bir kez aç dene (engellenecek — bu normal)

Launchpad'den **Mahmut Celayir**'e çift tıkla.

> Bir uyarı kutusu çıkacak: **"'Mahmut Celayir' hasarlı, açılamıyor. Çöp Kutusu'na taşımalısınız."** / **"'Mahmut Celayir' is damaged and can't be opened. You should move it to the Trash."**
>
> ❌ **"Çöp Kutusu'na Taşı" / "Move to Trash"** butonuna basma!
> ✅ **"Tamam" / "Done"** veya **"Vazgeç" / "Cancel"** bas, kutu kapansın.

### 3. Adım: Sistem Ayarları'nı aç

Sol üstte **Apple () menüsü** → **Sistem Ayarları** / **System Settings**.

### 4. Adım: Gizlilik ve Güvenlik bölümüne git

Sol kenardan **Gizlilik ve Güvenlik** / **Privacy & Security** seçeneğine tıkla.

### 5. Adım: "Güvenlik" bölümünü bul ve "Yine de Aç" butonuna bas

Sayfayı **aşağı kaydır**. **"Güvenlik" / "Security"** başlığını göreceksin. Onun altında şöyle bir mesaj olacak:

> **"'Mahmut Celayir' kimliği belirlenmiş bir geliştiriciden olmadığı için engellendi."**
> **"'Mahmut Celayir' was blocked because it is not from an identified developer."**

Mesajın yanında **"Yine de Aç" / "Open Anyway"** butonu var. **Ona bas.**

### 6. Adım: Touch ID veya parola onayı

macOS senden onay isteyecek:
- Touch ID parmak izi vermen gerekebilir, **VEYA**
- Mac kullanıcı parolanı yazıp **Tamam** / **OK** basman gerekebilir

### 7. Adım: ⚠️ Kritik — son onay kutusu

**Burada çoğu kişi takılıyor.** İkinci bir uyarı kutusu çıkacak:

> **"macOS, 'Mahmut Celayir' geliştiricisini doğrulayamıyor. Yine de açmak istediğinizden emin misiniz?"**
> **"macOS cannot verify the developer of 'Mahmut Celayir'. Are you sure you want to open it?"**

Üç buton görebilirsin: **"Çöp Kutusu'na Taşı"** / **"Tamam"** / **"Aç"**.

✅ **Mutlaka "Aç" / "Open"** butonuna bas. Diğerleri işe yaramaz.

### 8. Adım: Bitti

Uygulama açılır. Bundan sonra **her zaman** normal çift tıklamayla açacak — bu uyarıları bir daha görmeyeceksin.

---

## 🤔 Neden bu kadar uğraş?

Apple, kendi sertifikasıyla imzalanmamış uygulamaları otomatik kilitliyor. Benim Apple Developer hesabım şu an yenilenme aşamasında — bu yüzden uygulama henüz imzalanmamış halde geliyor.

Yenileme bittiğinde sana yeni bir versiyon göndereceğim — o versiyon imzalı olacak ve hiçbir şey yapmana gerek kalmayacak. Sadece çift tıkla ve aç.

Şimdilik bu **tek seferlik** bir engel — ilk açılışta çözdükten sonra bir daha hiç görmezsin.

---

## 🆘 Bir şey hâlâ olmuyorsa

Bana **ekran görüntüsü** gönder (Shift ⇧ + Cmd ⌘ + 4 basıp, gördüğün hatayı seçerek çek, masaüstünde dosya oluşur).

Görüntüyü WhatsApp veya iMessage'dan yolla, hemen bakarım.

— Bedirhan
