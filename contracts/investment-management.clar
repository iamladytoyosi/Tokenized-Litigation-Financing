;; Investment Management Contract
;; Tracks capital contributions to legal cases

(define-data-var admin principal tx-sender)
(define-data-var next-investment-id uint u1)

;; Token for representing investment shares
(define-fungible-token litigation-token)

(define-map investments
  { investment-id: uint }
  {
    investor: principal,
    case-id: uint,
    amount: uint,
    tokens-issued: uint,
    investment-date: uint
  }
)

(define-map case-investments
  { case-id: uint }
  {
    total-invested: uint,
    total-tokens: uint,
    is-open: bool
  }
)

(define-read-only (get-investment (investment-id uint))
  (map-get? investments { investment-id: investment-id })
)

(define-read-only (get-case-investment-data (case-id uint))
  (default-to
    { total-invested: u0, total-tokens: u0, is-open: false }
    (map-get? case-investments { case-id: case-id }))
)

(define-public (open-case-for-investment (case-id uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u1)) ;; Not authorized
    (ok (map-set case-investments
      { case-id: case-id }
      { total-invested: u0, total-tokens: u0, is-open: true }
    ))
  )
)

(define-public (close-case-for-investment (case-id uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u1)) ;; Not authorized
    (let ((case-data (get-case-investment-data case-id)))
      (ok (map-set case-investments
        { case-id: case-id }
        (merge case-data { is-open: false })
      ))
    )
  )
)

(define-public (invest (case-id uint) (amount uint))
  (let (
    (case-data (get-case-investment-data case-id))
    (investment-id (var-get next-investment-id))
    (tokens-to-mint (if (is-eq (get total-invested case-data) u0)
                      amount
                      (/ (* amount (get total-tokens case-data)) (get total-invested case-data))))
  )
    (asserts! (get is-open case-data) (err u2)) ;; Case not open for investment
    (asserts! (> amount u0) (err u3)) ;; Invalid amount

    ;; Update next investment ID
    (var-set next-investment-id (+ investment-id u1))

    ;; Record the investment
    (map-set investments
      { investment-id: investment-id }
      {
        investor: tx-sender,
        case-id: case-id,
        amount: amount,
        tokens-issued: tokens-to-mint,
        investment-date: (unwrap-panic (get-block-info? time u0))
      }
    )

    ;; Update case investment totals
    (map-set case-investments
      { case-id: case-id }
      {
        total-invested: (+ (get total-invested case-data) amount),
        total-tokens: (+ (get total-tokens case-data) tokens-to-mint),
        is-open: (get is-open case-data)
      }
    )

    ;; Mint tokens to the investor
    (ft-mint? litigation-token tokens-to-mint tx-sender)
  )
)

(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u4)) ;; Not authorized
    (ok (var-set admin new-admin))
  )
)

