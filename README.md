# Înlocuitor Mail Simplificat (În Construcție)

Aplicație modernă pentru gestiunea corespondenței prin IMAP, integrată cu:
- **Panou de administrare separat** protejat de o parolă dedicată
- **Autentificare utilizatori cu 2 Factor Authentication (2FA)** prin Google Authenticator
- **Structuri ierarhice nelimitate pe oricâte nivele** cu denumiri editabile direct din panoul de administrare.

---

## 🚀 Pornire Rapidă

Pentru a lansa atât serverul API Express (port 3005), cât și interfața web React/Vite (port 5175):

```bash
npm run dev
```

- **Interfață utilizator:** http://localhost:5175
- **API Server:** http://localhost:3005

---

## 🔐 Credențiale Implicite

| Destinație | Cont / Nume | Parolă | Tip Autentificare |
|---|---|---|---|
| **Panou Administrare** | *Parolă Master* | `admin1234` | Parolă separată dedicată |
| **Utilizator cu 2FA** | `operator` | `operator123` | Parolă + Google Authenticator |
| **Utilizator Simplu** | `utilizator` | `utilizator123` | Parolă directă (fără 2FA) |

---

## 🌟 Funcționalități Implementate

1. **Protocol IMAP Securizat:**
   - Conexiune SSL/TLS pe port 993 prin `imapflow`.
   - Sincronizare mesaje noi, descărcare și parsare MIME completă cu `mailparser`.
   - Buton de test conexiune și sincronizare live din interfață.

2. **Panou de Administrare cu Parolă Separată:**
   - Accesibil prin butonul "Panou Administrare" din antet.
   - Solicită o parolă de administrare dedicată (independentă de parolele utilizatorilor).
   - Permite schimbarea parolei de administrare oricând.

3. **Autentificare Utilizatori & 2FA Google:**
   - Compatibilitate totală cu aplicația **Google Authenticator** (iOS / Android) conform RFC 6238 TOTP.
   - Panoul de administrare generează coduri QR de înaltă rezoluție și chei de configurare manuală.
   - Tester integrat pentru validarea codului de 6 cifre înainte de activarea pe cont.

4. **Structuri Ierarhice Nelimitate:**
   - Arbore ierarhic complet dinamic: Rădăcină (Nivel 1) -> Subnivel (Nivel 2) -> Sub-subnivel (Nivel 3) -> Nivel N.
   - Fiecare nivel are o denumire asociată, cod, descriere și culoare, toate editabile din administrare.
   - Utilizatorii pot clasifica e-mailurile în oricare dintre nodurile ierarhice.
   - Bara laterală filtrează e-mailurile direct în funcție de nivelul ierarhic selectat.
