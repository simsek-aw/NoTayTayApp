// ============================================================================
//  i18n — Sprachumschaltung Deutsch / Türkisch
// ============================================================================
const KEY = 'babysleep.lang';

const DICT = {
  de: {
    // Header / allgemein
    aria_nightmode: 'Nachtmodus', aria_settings: 'Einstellungen', aria_close: 'Schließen', aria_edit: 'Bearbeiten',
    unit_h: 'Std', unit_min: 'Min',
    install_text: '📲 Zum Startbildschirm hinzufügen für den App-Start.',
    install_ios: '📲 Installieren: „Teilen" → „Zum Home-Bildschirm".',
    install_add: 'Hinzufügen',
    // Karten-Titel
    today: 'Heute', yesterday: 'Gestern', entry_add: '+ Eintrag',
    trend_title: 'Letzte 7 Tage', review_title: 'Prognose-Rückblick (Nickerchen)',
    heat_title: 'Schlaf-Kalender (Gesamt/Tag)', plan_title: 'Plan für den Tag',
    plan_hint: 'Prognose auf Basis von Alter & deinen bisherigen Aufzeichnungen.',
    history: 'Verlauf', empty_history: 'Noch keine Einträge. Starte das erste Nickerchen!',
    nap: 'Nickerchen', night: 'Nacht', naptype: 'Nickerchen', nighttype: 'Nachtschlaf',
    // Einstellungen
    settings: 'Einstellungen', sync_head: '👨‍👩‍👧 Familien-Sync',
    sync_intro: 'Gebt auf allen Handys denselben Code ein — dann seht ihr alle live dieselben Daten.',
    family_code: 'Familien-Code', ph_code: 'Code eingeben oder erzeugen',
    gen_code: '🎲 Code erzeugen', connect: 'Verbinden', code_prefix: 'Code:',
    copy_code: '📋 Code kopieren', disconnect: 'Sync trennen',
    sync_unavailable: '⚠️ Sync ist noch nicht konfiguriert (Firebase-Zugang fehlt).',
    notify_head: '🔔 Erinnerungen', notify_desc: 'Benachrichtigung 30 Minuten vor der nächsten Schlafphase.',
    notify_enable: 'Erinnerungen aktivieren', notify_disable: 'Ausschalten',
    notify_unavailable: '⚠️ Dieses Gerät/dieser Browser unterstützt keine Benachrichtigungen.',
    report_btn: '📄 Bericht für Kinderarzt', reset_btn: 'Auf Startdaten zurücksetzen',
    local_note: 'Alle Daten werden nur lokal auf diesem Gerät gespeichert.',
    on: 'an', off: 'aus', na: 'n/v',
    badge_connecting: 'verbindet…', badge_connected: 'verbunden', badge_error: 'Fehler',
    dim_exit: '☀️ Nachtmodus beenden', t_code_invalid: 'Bitte einen gültigen Code eingeben (oder erzeugen)',
    // Manueller Eintrag
    entry: 'Eintrag', entry_edit: 'Eintrag bearbeiten', entry_new: 'Eintrag hinzufügen',
    kind: 'Art', start: 'Beginn', end: 'Ende', end_hint: '(leer = läuft noch)',
    del: 'Löschen', save: 'Speichern',
    // Kreis-Zentrum / Tracker
    newday: '☀️ Neuer Tag', newday_sub: 'Noch nichts getrackt – unten starten',
    next_nap: '😴 Nächstes Nickerchen', bedtime: '🌙 Schlafenszeit',
    sleeping_nap: '😴 Schläft', sleeping_night: '🌙 Schläft (Nacht)',
    nap_running: '😴 Nickerchen läuft', c_night: '🌙 Nacht', c_nap: '😴 Nickerchen',
    c_wake: '🌅 Aufwachen', forecast: 'Prognose', awake: '☀️ Wach', daysleep: 'Tagesschlaf',
    naps_n: '{n} Nickerchen', night_d: 'Nacht {d}',
    since: 'seit {t}', ca_until: 'ca. bis {t}', in_t: 'in {d}', overdue: '⚠️ {d} überfällig',
    night_running: '🌙 Nacht läuft', nap_running2: '😴 Nickerchen läuft',
    start_nap: '😴 Nickerchen starten', start_night: '🌙 Schlafenszeit (Nacht) starten',
    end_nap: '⏹ Nickerchen beenden', end_night: '🌅 Aufgewacht (Nacht beenden)',
    chip_fell: 'eingeschlafen vor {m} Min', running: 'läuft …', today_empty: 'Noch nichts getrackt.',
    // Toasts
    t_nap_started: 'Nickerchen gestartet', t_night: 'Gute Nacht! 🌙',
    t_woke: 'Aufgewacht — gut geschlafen! 👶', t_nap_ago: 'Nickerchen vor {m} Min gestartet',
    undo: 'Rückgängig', saved: 'Gespeichert',
    t_notify_on: 'Erinnerungen aktiviert 🔔', t_notify_denied: 'Benachrichtigungen wurden abgelehnt',
    t_notify_off: 'Erinnerungen ausgeschaltet', t_no_code: 'Bitte zuerst einen Code eingeben oder erzeugen',
    t_connecting: 'Verbinde …', t_connected: 'Verbunden ✓', t_sync_err: 'Sync fehlgeschlagen',
    t_copied: 'Code kopiert 📋', t_disconnected: 'Sync getrennt (Daten bleiben lokal erhalten)',
    t_need_start: 'Bitte Beginn angeben', t_end_after: 'Ende muss nach dem Beginn liegen',
    confirm_del: 'Diesen Eintrag löschen?', confirm_reset: 'Live getrackte Einträge zurücksetzen und Mirays Startdaten neu laden?',
    // Übersicht
    sum_naps: 'Nickerchen', sum_day: 'Tagschlaf', sum_total: 'Gesamt 24h',
    typ: 'typ. {x}', night_missing: 'Nacht fehlt',
    last_night: 'Letzte Nacht: {d}.', last_night_none: 'Letzte Nacht noch nicht erfasst.',
    // Trend
    legend_nap: 'Nickerchen', legend_night: 'Nacht',
    transition: '👶 Miray ist im Übergang von 2 auf 1 Nickerchen (Ø {avg}/Tag, {o}× ein, {t}× zwei).',
    // Rückblick
    rv_dev: 'Ø Abweichung (Min)', rv_within: 'im ±30-Min-Fenster', rv_tend: 'Tendenz (Min)',
    later: 'später', earlier: 'früher',
    rv_hint: 'Letzte {n} Nickerchen: Vorhersage vs. tatsächlich. Oben = später als vorhergesagt (gelb), unten = früher (blau).',
    // Heatmap
    heat_legend: 'wenig {boxes} viel · Gesamtschlaf/Tag',
    // Plan
    nap_n: '{n}. Nickerchen', plan_bed: 'Schlafenszeit',
    // Schub
    sh_longer: '📈 Wachfenster werden länger (Ø +{d} Min) – Miray entwickelt sich weiter. Die Prognose zieht automatisch mit.',
    sh_shorter: '📉 Wachfenster zuletzt kürzer (Ø {d} Min) – evtl. Schlafregression oder Übermüdung. Etwas früher hinlegen kann helfen.',
    sh_dropnap: '🔄 Zuletzt weniger Nickerchen – vermutlich der Übergang von 2 auf 1.',
    // Alter
    age_mon: '{n} Mon.', age_wk: '{w} Wo. ({d} T.)',
    // Bericht
    rp_title: 'Schlafbericht – {name}',
    rp_sub: 'Alter: {age} (geb. {date}) · Stand: {today} · Richtwert-Altersgruppe: {label}',
    rp_age_wk: '{n} Wochen', rp_age_mon: '{n} Monate',
    rp_avg: 'Durchschnitt (vollständige Tage, letzte 7)',
    rp_k_naps: 'Nickerchen / Tag', rp_k_day: 'Tagschlaf / Tag', rp_k_night: 'Nachtschlaf', rp_k_total: 'Gesamtschlaf / Tag',
    rp_table: 'Tagesübersicht (7 Tage)',
    rp_c_day: 'Tag', rp_c_naps: 'Nickerchen', rp_c_daysleep: 'Tagschlaf', rp_c_night: 'Nacht', rp_c_total: 'Gesamt',
    rp_acc_title: 'Prognose-Treffsicherheit (Nickerchen)',
    rp_acc: 'Ø Abweichung ±{a} Min · {p}% im ±30-Min-Fenster (letzte {n}).',
    rp_print: '🖨️ Drucken / als PDF', rp_close: 'Schließen',
    rp_foot: 'Erstellt mit Schlummer. Richtwerte dienen der Orientierung und ersetzen keine ärztliche Beratung.',
    ntf_active_title: '🔔 Erinnerungen aktiv', ntf_active_body: 'Du wirst 30 Minuten vor der nächsten Schlafphase erinnert.',
    ntf_soon_title: '😴 Bald müde', ntf_soon_body: 'In {min} Minuten: {what} (ca. {t}).',
    ntf_now_title: '🌙 Zeit zum Schlafen', ntf_now_body: '{what} — jetzt ist ein gutes Zeitfenster.',
    ntf_what_night: 'Schlafenszeit 🌙', ntf_what_nap: '{n}. Nickerchen 😴',
    age_labels: {
      '0–1 Monat': '0–1 Monat', '1–2 Monate': '1–2 Monate', '2–3 Monate': '2–3 Monate',
      '3–4 Monate': '3–4 Monate', '4–5 Monate': '4–5 Monate', '5–6 Monate': '5–6 Monate',
      '6–7 Monate': '6–7 Monate', '7–9 Monate': '7–9 Monate', '9–12 Monate': '9–12 Monate',
      '12–15 Monate': '12–15 Monate', '15–18 Monate': '15–18 Monate', '18–24 Monate': '18–24 Monate', '2+ Jahre': '2+ Jahre',
    },
    wk: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  },
  tr: {
    aria_nightmode: 'Gece modu', aria_settings: 'Ayarlar', aria_close: 'Kapat', aria_edit: 'Düzenle',
    unit_h: 'sa', unit_min: 'dk',
    install_text: '📲 Uygulama gibi açmak için ana ekrana ekle.',
    install_ios: '📲 Yükle: „Paylaş" → „Ana Ekrana Ekle".',
    install_add: 'Ekle',
    today: 'Bugün', yesterday: 'Dün', entry_add: '+ Kayıt',
    trend_title: 'Son 7 gün', review_title: 'Tahmin geçmişi (Şekerleme)',
    heat_title: 'Uyku takvimi (Günlük toplam)', plan_title: 'Günün planı',
    plan_hint: 'Tahmin, yaşa ve şimdiye kadarki kayıtlara dayanır.',
    history: 'Geçmiş', empty_history: 'Henüz kayıt yok. İlk şekerlemeyi başlat!',
    nap: 'Şekerleme', night: 'Gece', naptype: 'Şekerleme', nighttype: 'Gece uykusu',
    settings: 'Ayarlar', sync_head: '👨‍👩‍👧 Aile senkronu',
    sync_intro: 'Tüm telefonlara aynı kodu girin — böylece herkes aynı verileri canlı görür.',
    family_code: 'Aile kodu', ph_code: 'Kod gir veya oluştur',
    gen_code: '🎲 Kod oluştur', connect: 'Bağlan', code_prefix: 'Kod:',
    copy_code: '📋 Kodu kopyala', disconnect: 'Senkronu kes',
    sync_unavailable: '⚠️ Senkron henüz yapılandırılmadı (Firebase erişimi yok).',
    notify_head: '🔔 Hatırlatmalar', notify_desc: 'Bir sonraki uyku vaktinden 30 dakika önce bildirim.',
    notify_enable: 'Hatırlatmaları aç', notify_disable: 'Kapat',
    notify_unavailable: '⚠️ Bu cihaz/tarayıcı bildirimleri desteklemiyor.',
    report_btn: '📄 Doktor için rapor', reset_btn: 'Başlangıç verilerine sıfırla',
    local_note: 'Tüm veriler yalnızca bu cihazda yerel olarak saklanır.',
    on: 'açık', off: 'kapalı', na: 'yok',
    badge_connecting: 'bağlanıyor…', badge_connected: 'bağlı', badge_error: 'Hata',
    dim_exit: '☀️ Gece modunu bitir', t_code_invalid: 'Lütfen geçerli bir kod gir (veya oluştur)',
    entry: 'Kayıt', entry_edit: 'Kaydı düzenle', entry_new: 'Kayıt ekle',
    kind: 'Tür', start: 'Başlangıç', end: 'Bitiş', end_hint: '(boş = devam ediyor)',
    del: 'Sil', save: 'Kaydet',
    newday: '☀️ Yeni gün', newday_sub: 'Henüz kayıt yok – aşağıdan başlat',
    next_nap: '😴 Sıradaki şekerleme', bedtime: '🌙 Uyku vakti',
    sleeping_nap: '😴 Uyuyor', sleeping_night: '🌙 Uyuyor (Gece)',
    nap_running: '😴 Şekerleme sürüyor', c_night: '🌙 Gece', c_nap: '😴 Şekerleme',
    c_wake: '🌅 Uyanma', forecast: 'Tahmin', awake: '☀️ Uyanık', daysleep: 'Gündüz uykusu',
    naps_n: '{n} şekerleme', night_d: 'Gece {d}',
    since: '{t} itibarıyla', ca_until: 'yakl. {t} kadar', in_t: '{d} içinde', overdue: '⚠️ {d} gecikti',
    night_running: '🌙 Gece sürüyor', nap_running2: '😴 Şekerleme sürüyor',
    start_nap: '😴 Şekerleme başlat', start_night: '🌙 Gece uykusunu başlat',
    end_nap: '⏹ Şekerlemeyi bitir', end_night: '🌅 Uyandı (Geceyi bitir)',
    chip_fell: '{m} dk önce uyudu', running: 'sürüyor …', today_empty: 'Henüz kayıt yok.',
    t_nap_started: 'Şekerleme başladı', t_night: 'İyi geceler! 🌙',
    t_woke: 'Uyandı — iyi uyudu! 👶', t_nap_ago: 'Şekerleme {m} dk önce başladı',
    undo: 'Geri al', saved: 'Kaydedildi',
    t_notify_on: 'Hatırlatmalar açıldı 🔔', t_notify_denied: 'Bildirimlere izin verilmedi',
    t_notify_off: 'Hatırlatmalar kapatıldı', t_no_code: 'Lütfen önce bir kod girin veya oluşturun',
    t_connecting: 'Bağlanıyor …', t_connected: 'Bağlandı ✓', t_sync_err: 'Senkron başarısız',
    t_copied: 'Kod kopyalandı 📋', t_disconnected: 'Senkron kesildi (veriler cihazda kalır)',
    t_need_start: 'Lütfen başlangıç gir', t_end_after: 'Bitiş, başlangıçtan sonra olmalı',
    confirm_del: 'Bu kayıt silinsin mi?', confirm_reset: 'Canlı kayıtlar sıfırlanıp Miray\'ın başlangıç verileri yeniden yüklensin mi?',
    sum_naps: 'Şekerleme', sum_day: 'Gündüz', sum_total: '24s toplam',
    typ: 'tip. {x}', night_missing: 'Gece eksik',
    last_night: 'Dün gece: {d}.', last_night_none: 'Dün gece henüz kaydedilmedi.',
    legend_nap: 'Şekerleme', legend_night: 'Gece',
    transition: '👶 Miray 2 şekerlemeden 1\'e geçiş döneminde (günde ort. {avg}, {o}× bir, {t}× iki).',
    rv_dev: 'Ort. sapma (dk)', rv_within: '±30 dk aralığında', rv_tend: 'Eğilim (dk)',
    later: 'sonra', earlier: 'önce',
    rv_hint: 'Son {n} şekerleme: tahmin vs. gerçek. Üst = tahminden sonra (sarı), alt = önce (mavi).',
    heat_legend: 'az {boxes} çok · Günlük toplam uyku',
    nap_n: '{n}. şekerleme', plan_bed: 'Uyku vakti',
    sh_longer: '📈 Uyanık kalma süreleri uzuyor (ort. +{d} dk) – Miray gelişiyor. Tahmin otomatik uyum sağlar.',
    sh_shorter: '📉 Uyanık süreler son zamanlarda kısaldı (ort. {d} dk) – uyku regresyonu veya aşırı yorgunluk olabilir. Biraz erken yatırmak yardımcı olabilir.',
    sh_dropnap: '🔄 Son zamanlarda daha az şekerleme – muhtemelen 2\'den 1\'e geçiş.',
    age_mon: '{n} ay', age_wk: '{w} hf ({d} g)',
    rp_title: 'Uyku raporu – {name}',
    rp_sub: 'Yaş: {age} (doğum {date}) · Tarih: {today} · Yaş grubu: {label}',
    rp_age_wk: '{n} hafta', rp_age_mon: '{n} ay',
    rp_avg: 'Ortalama (tam günler, son 7)',
    rp_k_naps: 'Şekerleme / gün', rp_k_day: 'Gündüz uykusu / gün', rp_k_night: 'Gece uykusu', rp_k_total: 'Toplam uyku / gün',
    rp_table: 'Günlük özet (7 gün)',
    rp_c_day: 'Gün', rp_c_naps: 'Şekerleme', rp_c_daysleep: 'Gündüz', rp_c_night: 'Gece', rp_c_total: 'Toplam',
    rp_acc_title: 'Tahmin isabeti (Şekerleme)',
    rp_acc: 'Ort. sapma ±{a} dk · %{p} ±30 dk aralığında (son {n}).',
    rp_print: '🖨️ Yazdır / PDF', rp_close: 'Kapat',
    rp_foot: 'Schlummer ile oluşturuldu. Değerler yol göstericidir, tıbbi tavsiyenin yerini tutmaz.',
    ntf_active_title: '🔔 Hatırlatmalar açık', ntf_active_body: 'Bir sonraki uyku vaktinden 30 dakika önce hatırlatılır.',
    ntf_soon_title: '😴 Birazdan yorgun', ntf_soon_body: '{min} dakika içinde: {what} (yakl. {t}).',
    ntf_now_title: '🌙 Uyku zamanı', ntf_now_body: '{what} — şimdi iyi bir zaman.',
    ntf_what_night: 'Uyku vakti 🌙', ntf_what_nap: '{n}. şekerleme 😴',
    age_labels: {
      '0–1 Monat': '0–1 ay', '1–2 Monate': '1–2 ay', '2–3 Monate': '2–3 ay',
      '3–4 Monate': '3–4 ay', '4–5 Monate': '4–5 ay', '5–6 Monate': '5–6 ay',
      '6–7 Monate': '6–7 ay', '7–9 Monate': '7–9 ay', '9–12 Monate': '9–12 ay',
      '12–15 Monate': '12–15 ay', '15–18 Monate': '15–18 ay', '18–24 Monate': '18–24 ay', '2+ Jahre': '2+ yıl',
    },
    wk: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
  },
};

let lang = 'de';
try { const s = localStorage.getItem(KEY); if (s === 'tr' || s === 'de') lang = s; } catch { /* ignore */ }

export function getLang() { return lang; }
export function setLang(l) {
  lang = (l === 'tr') ? 'tr' : 'de';
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  try { document.documentElement.lang = lang; } catch { /* ignore */ }
}
export function locale() { return lang === 'tr' ? 'tr-TR' : 'de-DE'; }
export function wkShort() { return DICT[lang].wk; }
export function ageLabel(deLabel) { return (DICT[lang].age_labels && DICT[lang].age_labels[deLabel]) || deLabel; }

export function t(key, vars) {
  let s = (DICT[lang] && DICT[lang][key]);
  if (s == null) s = DICT.de[key];
  if (s == null) return key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
  return s;
}
