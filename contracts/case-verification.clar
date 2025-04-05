;; Case Verification Contract
;; Validates legitimate legal proceedings

(define-data-var admin principal tx-sender)

;; Case status: 0 = pending, 1 = verified, 2 = rejected
(define-map cases
  { case-id: uint }
  {
    plaintiff: principal,
    defendant: (optional principal),
    court-jurisdiction: (string-utf8 100),
    case-details: (string-utf8 500),
    filing-date: uint,
    status: uint,
    verifier: (optional principal)
  }
)

(define-read-only (get-case (case-id uint))
  (map-get? cases { case-id: case-id })
)

(define-public (register-case
    (case-id uint)
    (defendant (optional principal))
    (court-jurisdiction (string-utf8 100))
    (case-details (string-utf8 500))
    (filing-date uint))
  (begin
    (asserts! (is-none (get-case case-id)) (err u1)) ;; Case ID already exists
    (ok (map-set cases
      { case-id: case-id }
      {
        plaintiff: tx-sender,
        defendant: defendant,
        court-jurisdiction: court-jurisdiction,
        case-details: case-details,
        filing-date: filing-date,
        status: u0,
        verifier: none
      }
    ))
  )
)

(define-public (verify-case (case-id uint))
  (let ((case-data (unwrap! (get-case case-id) (err u2)))) ;; Case not found
    (asserts! (is-eq tx-sender (var-get admin)) (err u3)) ;; Not authorized
    (asserts! (is-eq (get status case-data) u0) (err u4)) ;; Case not in pending status
    (ok (map-set cases
      { case-id: case-id }
      (merge case-data {
        status: u1,
        verifier: (some tx-sender)
      })
    ))
  )
)

(define-public (reject-case (case-id uint))
  (let ((case-data (unwrap! (get-case case-id) (err u2)))) ;; Case not found
    (asserts! (is-eq tx-sender (var-get admin)) (err u3)) ;; Not authorized
    (asserts! (is-eq (get status case-data) u0) (err u4)) ;; Case not in pending status
    (ok (map-set cases
      { case-id: case-id }
      (merge case-data {
        status: u2,
        verifier: (some tx-sender)
      })
    ))
  )
)

(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u3)) ;; Not authorized
    (ok (var-set admin new-admin))
  )
)

