# PHAO API CHAM NHANH PC1-PC30

Mo file nay khi cham. Lam dung thu tu tu PC1 den PC30.

## 10 BO DU LIEU LUYEN TAP

Chay tai thu muc goc repository sau khi `docker compose up -d --build` va cac service da healthy:

```powershell
Get-Content backend/infra/postgres/seed-manual-test.sql -Raw | docker compose exec -T postgres psql -U cab -d cab_identity_db -v ON_ERROR_STOP=1
```

Script thay the dung cac ID co dinh cua bo luyen tap, giu cac tai khoan/booking khac. Vi vay tai khoan kh01, kh02 co the thay them booking cu neu ban da tung thuc hanh; dung ID trong bang de chon dung mau. Co the chay lai de dat lai bo luyen tap. Neu da thay doi du lieu qua API, chay lai script se dat lai cac mau nay. Dang nhap moi sau khi nap lai de lay token con han. Khong nap khi dang thao tac API tren cung cac mau.

Mat khau chung: `12345678`. Admin luyen tap: `adm01@gmail.com` / `12345678`.
Moi dong co 1 Customer va 1 Driver cung so thu tu. Ca 10 Driver da duoc duyet; Driver 01-06 ONLINE, 07-10 OFFLINE. Ca 10 Driver o gan diem don mac dinh; API nearby mac dinh tra it nhat 6 Driver ONLINE trong ban kinh 3 km. Moi customer co 3 booking COMPLETED:

- Mau A: da thanh toan ONLINE, chua co review. Dung cho PC20 hoac PC26.
- Mau B: chua thanh toan, da co review 4 sao. Dung cho PC19.
- Mau C: da thanh toan va co review 5 sao. Dung de xem lich su.

| So | Customer | Driver | Booking A / Trip A | Booking B / Trip B | Booking C / Trip C |
| --- | --- | --- | --- | --- | --- |
| 01 | kh01@gmail.com | dr01@gmail.com | 001 / 001 | 002 / 002 | 003 / 003 |
| 02 | kh02@gmail.com | dr02@gmail.com | 004 / 004 | 005 / 005 | 006 / 006 |
| 03 | kh03@gmail.com | dr03@gmail.com | 007 / 007 | 008 / 008 | 009 / 009 |
| 04 | kh04@gmail.com | dr04@gmail.com | 010 / 010 | 011 / 011 | 012 / 012 |
| 05 | kh05@gmail.com | dr05@gmail.com | 013 / 013 | 014 / 014 | 015 / 015 |
| 06 | kh06@gmail.com | dr06@gmail.com | 016 / 016 | 017 / 017 | 018 / 018 |
| 07 | kh07@gmail.com | dr07@gmail.com | 019 / 019 | 020 / 020 | 021 / 021 |
| 08 | kh08@gmail.com | dr08@gmail.com | 022 / 022 | 023 / 023 | 024 / 024 |
| 09 | kh09@gmail.com | dr09@gmail.com | 025 / 025 | 026 / 026 | 027 / 027 |
| 10 | kh10@gmail.com | dr10@gmail.com | 028 / 028 | 029 / 029 | 030 / 030 |

ID day du: booking `40000000-0000-4000-8000-000000000001`, trip `50000000-0000-4000-8000-000000000001`; thay 3 chu so cuoi theo bang. Customer ID bat dau `10000000-0000-4000-8000-000000000001`, Driver ID bat dau `20000000-0000-4000-8000-000000000001`. Mau B khong co ban ghi payment; mau A/C co payment COMPLETED va trip paymentStatus PAID.

Vi du luyen nhanh voi Customer 01: dang nhap, `GET /bookings?page=1&limit=50` va tim ID theo bang; xem `GET /trips/50000000-0000-4000-8000-000000000001/review` (404), gui `POST /trips/50000000-0000-4000-8000-000000000001/reviews`; tao payment cho trip `50000000-0000-4000-8000-000000000002` theo PC19. Neu muon luyen lai review/payment, nap lai script.

PostgreSQL su dung port `5432` **ben trong Docker** (`postgres:5432`). Compose chi khai bao `expose: ["5432"]`, khong co `ports` cho postgres, nen khong co port PostgreSQL tren `localhost`; dung lenh `docker compose exec postgres psql ...` de truy cap. Port `5050` trong cau hinh la pgAdmin, khong phai PostgreSQL.

## DIA CHI CO DINH DE NHO

Ca 30 booking mau deu dung cung mot tuyen duong:

| Muc | Dia chi | Vi do (lat) | Kinh do (lng) |
| --- | --- | ---: | ---: |
| Diem don | Go Vap | 10.776 | 106.701 |
| Diem den | IUH | 10.797 | 106.721 |

Khoang cach mau: `3198 m`; gia mau: `28800 VND`. Body tao booking de copy vao Postman:

```json
{"pickup":{"address":"Go Vap","lat":10.776,"lng":106.701},"destination":{"address":"IUH","lat":10.797,"lng":106.721},"vehicleType":"BIKE"}
```

Tim tai xe gan diem don: `GET /drivers/nearby?lat=10.776&lng=106.701&radius=3000&page=1&limit=50` (token Customer). Sau khi nap seed, ket qua co toi thieu 6 tai xe ONLINE; Driver 01-06 deu cach diem don duoi 500 m.

| Driver ONLINE | Vi do | Kinh do | Cach diem don |
| --- | ---: | ---: | ---: |
| dr01@gmail.com | 10.776 | 106.701 | 0 m |
| dr02@gmail.com | 10.777 | 106.701 | 111 m |
| dr03@gmail.com | 10.778 | 106.701 | 222 m |
| dr04@gmail.com | 10.779 | 106.701 | 334 m |
| dr05@gmail.com | 10.776 | 106.702 | 109 m |
| dr06@gmail.com | 10.777 | 106.702 | 156 m |

Dia chi dich vu: API `http://localhost:8000/api/v1`; PostgreSQL `postgres:5432` chi trong mang Docker; pgAdmin `http://localhost:5050` khi chay profile `admin`. Chay `docker compose --profile admin up -d pgadmin` de bat pgAdmin (lenh `docker compose up -d` mac dinh khong bat service nay). Trong pgAdmin, ket noi PostgreSQL bang host `postgres`, port `5432`, user `cab`.

## DU LIEU CO DINH

    BASE = http://localhost:8000/api/v1

    Customer: kh01@gmail.com / 12345678
    Driver:   dr01@gmail.com / 12345678
    Admin:    adm01@gmail.com / 12345678

    Customer ID = 10000000-0000-4000-8000-000000000001
    Driver ID   = 20000000-0000-4000-8000-000000000001

Bien Postman:

    C = Customer accessToken
    D = Driver accessToken
    A = Admin accessToken

    bookingId, offerId, tripId, paymentId
    challengeId, otpCode, registrationToken, newDriverId

Header chung:

    Authorization: Bearer <token>
    Content-Type: application/json
    Idempotency-Key: pc<so>-01

Neu chay lai, doi 01 thanh 02. Khong dung cung key cho body khac.

## LOGIN LAY TOKEN

    POST /auth/login
    {"email":"kh01@gmail.com","password":"12345678"}

Doi email thanh dr01@gmail.com de lay D, adm01@gmail.com de lay A. Copy dung accessToken.

---

## PC1-PC8

### PC1 - Cau truc source

    cd backend
    ls
    cd ..

Noi: Gateway, 7 service, shared contract, infra va scripts; moi service so huu nghiep vu rieng.

### PC2 - Gitignore

    git check-ignore .env

Noi: .env, key, log va node_modules khong duoc commit.

### PC3 - Gateway

    GET /health

Dat: 200, healthy. Gateway xu ly route, JWT, RBAC, rate limit va request ID.

### PC4 - IPC

Noi: Client goi REST qua Gateway; service goi Internal REST co service token; Kafka truyen event; Redis dung cho rate limit/GEO; khong doc database cheo.

### PC5 - Docker Compose

    docker compose ps -a

Dat: Gateway, 7 service va ha tang dang chay; init co the Exited (0).

### PC6 - Health

    GET /health
    GET /ready
    GET /health/services

Dat: ca ba 200, du 7 service up.

### PC7 - Kafka

    docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --list

Dat: booking.events, driver.events, trip.events, payment.events, cab.dead-letter.

### PC8 - Chi Gateway public

    docker compose ps

Noi: chi Gateway public port 8000; PostgreSQL, MongoDB, Redis, Kafka va service chi chay trong network Docker.

---

## PC9-PC14

### PC9 - Dang ky Customer

    POST /auth/register
    Idempotency-Key: pc9-01
    {"fullName":"Khach Test","email":"kh99@gmail.com","phone":"0390000099","password":"12345678"}

Dat: 201, co customerId va userId.

### PC10 - Login

    POST /auth/login
    {"email":"kh01@gmail.com","password":"12345678"}

Dat: 200, co accessToken, role CUSTOMER, accountStatus ACTIVE.

JWT: payload doc khong can public key; Gateway dung public key de kiem tra chu ky RS256.

### PC11 - Customer xem minh

    GET /customers/me
    Token: C

Dat: 200, dung thong tin Customer.

### PC12 - Xem Driver public

Buoc 1, dung Admin lay ID Driver:

    GET /drivers
    Token: A

Copy truong id cua mot Driver.

Buoc 2, doi sang Customer token:

    GET /drivers/20000000-0000-4000-8000-000000000001
    Token: C

Thay ID co dinh trong URL bang Driver ID vua copy.

Dat: 200, co ten, xe, bien so; khong lo phone, CCCD hoac GPLX.

### PC13 - Driver gan nhat

    GET /drivers/nearby?lat=10.776&lng=106.701&radius=3000&page=1&limit=50
    Token: C

Dat: 200, total >= 6; co Driver 01-06 ONLINE, moi Driver cach diem don duoi 500 m.

### PC14 - Danh sach booking

    GET /bookings?page=1&limit=5
    Token: C

Dat: 200, co items, page, limit, total.

---

## PC15-PC20

### PC15 - Tao booking

    POST /bookings
    Token: C
    Idempotency-Key: pc15-01
    {"pickup":{"address":"Go Vap","lat":10.776,"lng":106.701},"destination":{"address":"IUH","lat":10.797,"lng":106.721},"vehicleType":"BIKE"}

Dat: 201, SEARCHING, co distanceM va quotedFareVnd. Copy bookingId.

Cong thuc: ceil(distanceM / 100) x 900.

### PC16 - Driver nhan offer

    GET /offers
    Token: D

Tim item co dung bookingId, copy truong id thanh offerId.

    POST /offers/{{offerId}}/accept
    Token: D
    Idempotency-Key: pc16-01
    {}

Dat: 200, ASSIGNED. Copy tripId.

### PC17 - Chay chuyen

Goi cung API ba lan bang token D:

    PATCH /trips/{{tripId}}/status
    {"status":"ARRIVED"}
    {"status":"IN_PROGRESS"}

Khi dang IN_PROGRESS:

    PUT /trips/{{tripId}}/location
    Token: D
    {"lat":10.78,"lng":106.71}

Sau do goi lai API status:

    {"status":"COMPLETED"}

Dat: Trip COMPLETED, paymentStatus UNPAID, Driver tro lai ONLINE.

Nho: ASSIGNED -> ARRIVED -> IN_PROGRESS -> COMPLETED.

### PC18 - Huy booking

Tao booking moi giong PC15 voi key pc18-create-01, copy ID moi.

    POST /bookings/{{bookingId}}/cancel
    Token: C
    Idempotency-Key: pc18-cancel-01
    {"reason":"Khach doi ke hoach"}

Dat: 200, CANCELED. Trip IN_PROGRESS khong duoc huy, tra 409.

### PC19 - Thanh toan online

Dung tripId da COMPLETED:

    POST /payments
    Token: C
    Idempotency-Key: pc19-pay-01
    {"tripId":"{{tripId}}","method":"ONLINE"}

Dat: 201, Payment PENDING. Copy paymentId.

    POST /payments/{{paymentId}}/sandbox-confirm
    Token: C
    Idempotency-Key: pc19-confirm-01
    {"scenario":"SUCCESS"}

Kiem tra:

    GET /payments/{{paymentId}}
    GET /trips/{{tripId}}

Dat: Payment COMPLETED, Trip paymentStatus PAID.

### PC20 - Review

    POST /trips/{{tripId}}/reviews
    Token: C
    Idempotency-Key: pc20-01
    {"stars":5,"comment":"Tai xe than thien"}

Dat: 201, stars 5.

---

## PC21-PC23

### PC21 - OTP va dang ky Driver

    POST /drivers/otp/request
    {"phone":"0399999998"}

Copy challengeId va otpCode ngau nhien. Khi verify, gui gia tri otpCode trong truong `code` (khong gui truong `otpCode`).

    POST /drivers/otp/verify
    {"phone":"0399999998","challengeId":"{{challengeId}}","code":"{{otpCode}}"}

Copy registrationToken.

    POST /drivers/register
    Authorization: Bearer {{registrationToken}}
    Idempotency-Key: pc21-01
    {"fullName":"Driver Test","email":"dr98@gmail.com","password":"12345678","vehicleType":"BIKE","plate":"59A-99998"}

    So dien thoai lay tu buoc OTP. citizenId va licenseNumber la tuy chon.

Dat: 201, PENDING_APPROVAL. Copy newDriverId.

### PC22 - Admin duyet Driver

    GET /admin/drivers/{{newDriverId}}
    Token: A

    POST /admin/drivers/{{newDriverId}}/approve
    Token: A
    {}

Dat: 200, Driver chuyen OFFLINE.

### PC23 - Driver ONLINE

Dang nhap Driver vua duyet de lay token moi.

    PUT /drivers/me/availability
    Token: Driver moi
    {"status":"ONLINE"}

Dat: 200, ONLINE.

---

## CHUAN BI RIENG CHO PC24-PC30

Lam phan nay truoc buoi cham, khong tinh vao 30 giay cua tung PC.

### 1. Luu du token

    C = Customer token con han
    D = Driver token con han
    A = Admin token con han
    BAD_C = copy C roi them x vao cuoi token

Khong ghi de C bang BAD_C.

### 2. Dung trip co san cho PC26 XSS

Dang nhap `kh02@gmail.com` / `12345678`, luu token thanh `C_XSS`.
Gan `xssTripId = 50000000-0000-4000-8000-000000000004` (mau A cua Customer 02).
Kiem tra `GET /trips/{{xssTripId}}/review` bang `C_XSS`: dat 404.
Giu nguyen trip nay, khong review truoc PC26. Review chi can trip COMPLETED, khong bat buoc thanh toan.

### 3. Chuan bi tung tab bao mat

    PC24: mo san anh/query bang chung password_hash, CCCD/GPLX ma hoa.
    PC25: mo san tab login voi payload SQL Injection.
    PC26: mo san POST /trips/{{xssTripId}}/reviews, chua bam Send.
    PC27: mo san GET /customers/me voi BAD_C.
    PC28: mo san PUT /drivers/me/availability voi token C.
    PC29: chuan bi anh/log 429 va Retry-After; khong chay 100 request luc cham.
    PC30: giu nguyen tab tao payment PC19, cung token C, body va key pc19-pay-01 de gui lai.

Neu da test rate limit truoc, doi it nhat 61 giay roi moi login lai.

---

## PC24-PC30

### PC24 - Du lieu nhay cam

Noi: Password hash bang scrypt; CCCD/GPLX ma hoa AES-GCM; API khong tra ban ro; key trong .secrets va bi Git ignore.

### PC25 - SQL Injection

    POST /auth/login
    {"email":"' OR 1=1 --","password":"anything"}

Dat: 401, khong co token, khong lo loi SQL.

### PC26 - XSS

Dung trip rieng da chuan bi, khong dung trip PC20:

    POST /trips/{{xssTripId}}/reviews
    Token: C_XSS
    Idempotency-Key: pc26-01
    {"stars":5,"comment":"<script>alert(1)</script>"}

Dat: output escape thanh &lt;script&gt;, khong thuc thi script.

### PC27 - JWT bi sua

    GET /customers/me
    Authorization: Bearer {{customerToken}}x

Dat: 401. Payload hoac signature bi sua khong vuot qua xac minh RS256.

### PC28 - Sai quyen

Co y dung Customer token:

    PUT /drivers/me/availability
    Token: C
    {"status":"ONLINE"}

Dat: 403, khong co side effect.

### PC29 - Rate limit

Noi: login gioi han 10 request/phut; booking gioi han 5 request/phut; vuot nguong tra 429 va Retry-After.

### PC30 - Replay payment / Idempotency

Trong phieu cham, `{"user_id":"USR123","amount":50000}` la vi du request payment. Voi API CAB, `user_id` duoc xac dinh tu Customer token va `amount` lay tu fare cua trip (mau hien tai 28800 VND). Gui nguyen JSON vi du cho `POST /payments` se tra `400 INVALID_ARGUMENT`, nen dung request hop le cua CAB de chung minh cung hanh vi. Replay la gui lai **ca request cu**: URL, Customer token, `Idempotency-Key` va body; chi gui lai JSON ma khong co token thi khong duoc xem la request hop le.

Dung chinh request tao payment da gui thanh cong o PC19; giu **cung Customer token, tripId, method va Idempotency-Key**:

    POST /payments
    Token: C
    Idempotency-Key: pc19-pay-01
    {"tripId":"{{tripId}}","method":"ONLINE"}

Gui lan 2 y het lan 1. Dat: 201, cung `paymentId` va cac gia tri response tao payment ban dau (thu tu field JSON co the khac); DB chi co 1 payment cho trip. Neu PC19 da confirm thanh cong, response replay van co `status: PENDING` cua lan tao dau tien; `GET /payments/{{paymentId}}` moi cho trang thai hien tai `COMPLETED`.

Cach noi khi cham: "Vi du USR123/50000 trong de tuong ung Customer token/tripId cua he thong em. Em gui lai dung request thanh toan cu, gom ca Idempotency-Key. He thong tra paymentId va response cu, khong tao payment thu hai; thanh toan da confirm van chi o trang thai COMPLETED mot lan."

Kiem tra them neu du thoi gian: cung token/key nhung body khac tra 422; cung trip/body nhung key moi tra 409 `PAYMENT_EXISTS`; Customer khac khong so huu trip tra 403. Replay y het khong bi tu choi: he thong tra lai ket qua cu. Day la kiem thu thanh toan sandbox, nen bang chung "khong double charge" la khong co payment/lan xu ly thu hai trong he thong, khong phai giao dich ngan hang that.

---

## CHUOI HOC THUOC

    Customer: register -> login -> booking SEARCHING
    Driver: offers -> accept -> trip ASSIGNED
    Trip: ASSIGNED -> ARRIVED -> IN_PROGRESS -> COMPLETED
    Payment: UNPAID -> PENDING -> COMPLETED -> Trip PAID
    Driver register: OTP request -> OTP verify -> register -> Admin approve -> ONLINE
    Security: SQLi 401 -> XSS escaped -> JWT sua 401 -> sai role 403 -> rate limit 429

## LOI DE GO SAI

    /health                       khong phai /heath
    /bookings?page=1&limit=5      khong phai /bookings/page=1&limit=5
    /drivers/nearby?...&lng=...   dung dau & that, khong dung \&
    offerId = offer.id            khong phai bookingId
    location dung PUT             khong dung PATCH
    payment chi tao sau khi trip COMPLETED
