import { describe, it, expect, beforeEach } from "vitest"

// Mock implementation for testing Clarity contracts
const mockInvestments = new Map()
const mockCaseInvestments = new Map()
const mockTxSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
const mockAdmin = mockTxSender
const mockBlockTime = 1617235200
let mockNextInvestmentId = 1
const mockTokenBalances = new Map()

// Mock functions to simulate Clarity contract behavior
const openCaseForInvestment = (caseId, sender) => {
  if (sender !== mockAdmin) {
    return { error: 1 }
  }
  
  mockCaseInvestments.set(caseId, {
    "total-invested": 0,
    "total-tokens": 0,
    "is-open": true,
  })
  
  return { success: true }
}

const closeCaseForInvestment = (caseId, sender) => {
  if (sender !== mockAdmin) {
    return { error: 1 }
  }
  
  const caseData = mockCaseInvestments.get(caseId) || {
    "total-invested": 0,
    "total-tokens": 0,
    "is-open": false,
  }
  
  mockCaseInvestments.set(caseId, {
    ...caseData,
    "is-open": false,
  })
  
  return { success: true }
}

const invest = (caseId, amount, sender) => {
  const caseData = mockCaseInvestments.get(caseId) || {
    "total-invested": 0,
    "total-tokens": 0,
    "is-open": false,
  }
  
  if (!caseData["is-open"]) {
    return { error: 2 }
  }
  
  if (amount <= 0) {
    return { error: 3 }
  }
  
  const tokensToMint =
      caseData["total-invested"] === 0
          ? amount
          : Math.floor((amount * caseData["total-tokens"]) / caseData["total-invested"])
  
  const investmentId = mockNextInvestmentId++
  
  mockInvestments.set(investmentId, {
    investor: sender,
    "case-id": caseId,
    amount,
    "tokens-issued": tokensToMint,
    "investment-date": mockBlockTime,
  })
  
  mockCaseInvestments.set(caseId, {
    "total-invested": caseData["total-invested"] + amount,
    "total-tokens": caseData["total-tokens"] + tokensToMint,
    "is-open": caseData["is-open"],
  })
  
  // Mint tokens to the investor
  const currentBalance = mockTokenBalances.get(sender) || 0
  mockTokenBalances.set(sender, currentBalance + tokensToMint)
  
  return { success: true, value: investmentId }
}

const getInvestment = (investmentId) => {
  return mockInvestments.get(investmentId) || null
}

const getCaseInvestmentData = (caseId) => {
  return (
      mockCaseInvestments.get(caseId) || {
        "total-invested": 0,
        "total-tokens": 0,
        "is-open": false,
      }
  )
}

describe("Investment Management Contract", () => {
  beforeEach(() => {
    mockInvestments.clear()
    mockCaseInvestments.clear()
    mockTokenBalances.clear()
    mockNextInvestmentId = 1
  })
  
  it("should open a case for investment", () => {
    const result = openCaseForInvestment(1, mockAdmin)
    
    expect(result.success).toBe(true)
    
    const caseData = getCaseInvestmentData(1)
    expect(caseData["is-open"]).toBe(true)
    expect(caseData["total-invested"]).toBe(0)
    expect(caseData["total-tokens"]).toBe(0)
  })
  
  it("should close a case for investment", () => {
    openCaseForInvestment(1, mockAdmin)
    
    const result = closeCaseForInvestment(1, mockAdmin)
    
    expect(result.success).toBe(true)
    
    const caseData = getCaseInvestmentData(1)
    expect(caseData["is-open"]).toBe(false)
  })
  
  it("should not open/close a case if not admin", () => {
    const result1 = openCaseForInvestment(1, "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP")
    expect(result1.error).toBe(1)
    
    openCaseForInvestment(1, mockAdmin)
    
    const result2 = closeCaseForInvestment(1, "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP")
    expect(result2.error).toBe(1)
  })
  
  it("should allow investment in an open case", () => {
    openCaseForInvestment(1, mockAdmin)
    
    const result = invest(1, 1000, mockTxSender)
    
    expect(result.success).toBe(true)
    
    const investmentId = result.value
    const investment = getInvestment(investmentId)
    expect(investment).not.toBeNull()
    expect(investment.amount).toBe(1000)
    expect(investment["tokens-issued"]).toBe(1000) // First investment gets 1:1 tokens
    
    const caseData = getCaseInvestmentData(1)
    expect(caseData["total-invested"]).toBe(1000)
    expect(caseData["total-tokens"]).toBe(1000)
    
    const investorBalance = mockTokenBalances.get(mockTxSender)
    expect(investorBalance).toBe(1000)
  })
  
  it("should not allow investment in a closed case", () => {
    openCaseForInvestment(1, mockAdmin)
    closeCaseForInvestment(1, mockAdmin)
    
    const result = invest(1, 1000, mockTxSender)
    
    expect(result.error).toBe(2)
  })
  
  it("should not allow investment with zero amount", () => {
    openCaseForInvestment(1, mockAdmin)
    
    const result = invest(1, 0, mockTxSender)
    
    expect(result.error).toBe(3)
  })
  
  it("should calculate tokens proportionally for subsequent investments", () => {
    openCaseForInvestment(1, mockAdmin)
    
    // First investment
    invest(1, 1000, mockTxSender)
    
    // Second investment
    const result = invest(1, 500, "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP")
    
    expect(result.success).toBe(true)
    
    const investmentId = result.value
    const investment = getInvestment(investmentId)
    expect(investment).not.toBeNull()
    expect(investment.amount).toBe(500)
    expect(investment["tokens-issued"]).toBe(500) // Should be proportional to first investment
    
    const caseData = getCaseInvestmentData(1)
    expect(caseData["total-invested"]).toBe(1500)
    expect(caseData["total-tokens"]).toBe(1500)
  })
})

