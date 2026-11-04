# OrnalDetailing

Nowoczesna, ciemna strona firmowa z backendem Node.js, bazą SQLite, rejestracją, logowaniem, sesjami i formularzem kontaktowym.

## Wymagania
- Node.js 20 lub nowszy
- npm

## Uruchomienie lokalne

```bash
npm install
```

Skopiuj `.env.example` do `.env` i ustaw własny sekret sesji (minimum 32 znaki).

```bash
npm start
```

Otwórz: http://localhost:3000

W trybie deweloperskim serwer uruchomi się również bez pliku `.env`, ale przed wdrożeniem publicznym koniecznie skonfiguruj własny `SESSION_SECRET` i `NODE_ENV=production`.

## Co działa
- Rejestracja użytkownika (hasła są hashowane przez bcrypt)
- Logowanie i wylogowanie
- Sesje przechowywane w SQLite, ciasteczko HttpOnly / SameSite=Lax
- Panel klienta po zalogowaniu
- Formularz kontaktowy zapisujący wiadomości do bazy SQLite
- Ograniczenie liczby prób logowania i wysyłania formularzy
- Podstawowe nagłówki bezpieczeństwa przez Helmet

## Ważne przed publikacją
1. Zmień `SESSION_SECRET` na długi, losowy sekret i ustaw `NODE_ENV=production` oraz HTTPS.
2. Uzupełnij prawdziwe dane firmy: telefon, e-mail, adres/obszar działania, godziny, cennik i zdjęcia.
3. Dodaj politykę prywatności, informację o administratorze danych i zgodę/klauzulę informacyjną odpowiednią do sposobu przetwarzania danych (RODO).
4. Formularz zapisuje wiadomości w bazie, ale nie wysyła e-maili. Do wysyłki powiadomień skonfiguruj dostawcę poczty.
5. Panel jest panelem klienta, nie panelem administratora. Nie udostępnia listy wiadomości ani zarządzania użytkownikami.
6. Przed realnym użyciem przeprowadź testy, aktualizuj zależności i skonfiguruj kopie zapasowe bazy.

## API
- `POST /api/register` — `{ name, email, password }`
- `POST /api/login` — `{ email, password }`
- `POST /api/logout`
- `GET /api/me`
- `POST /api/contact` — `{ name, email, service, message }`
