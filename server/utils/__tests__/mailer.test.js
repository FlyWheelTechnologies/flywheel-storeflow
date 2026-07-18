const { sendReceiptEmail } = require('../mailer');
const { Resend } = require('resend');

jest.mock('resend');

describe('mailer utils', () => {
  let mockSend;

  beforeEach(() => {
    mockSend = jest.fn().mockResolvedValue({ id: 'mock-id' });
    Resend.prototype.emails = {
      send: mockSend
    };
    jest.clearAllMocks();
  });

  describe('sendReceiptEmail', () => {
    const mockSale = {
      id: 123,
      total_amount: 100.00,
      payment_status: 'PAID',
      amount_paid: 100.00,
      balance_due: 0.00,
      created_at: '2023-01-01T00:00:00Z'
    };

    const mockCustomer = {
      name: 'John Doe',
      email: 'john@example.com'
    };

    it('should return undefined and not call resend if customer email is missing', async () => {
      const customerWithoutEmail = { name: 'John Doe' };
      const result = await sendReceiptEmail(mockSale, customerWithoutEmail);

      expect(result).toBeUndefined();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should return undefined and not call resend if customer is null', async () => {
      const result = await sendReceiptEmail(mockSale, null);

      expect(result).toBeUndefined();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should call resend with correct parameters when email is present', async () => {
      const result = await sendReceiptEmail(mockSale, mockCustomer);

      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        to: mockCustomer.email,
        subject: expect.stringContaining('Receipt for Sale #123'),
        html: expect.stringContaining('GHS 100.00')
      }));
      expect(result.success).toBe(true);
    });

    it('should call resend with adminEmail if customer has no email but adminEmail is provided', async () => {
      const customerWithoutEmail = { name: 'John Doe' };
      const result = await sendReceiptEmail(mockSale, customerWithoutEmail, 'admin@example.com');

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        to: 'admin@example.com',
        subject: expect.stringContaining('Receipt for Sale #123'),
        html: expect.stringContaining('GHS 100.00')
      }));
      expect(result.success).toBe(true);
    });

    it('should call resend with adminEmail if customer is null but adminEmail is provided', async () => {
      const result = await sendReceiptEmail(mockSale, null, 'admin@example.com');

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        to: 'admin@example.com',
        subject: expect.stringContaining('Receipt for Sale #123'),
        html: expect.stringContaining('GHS 100.00')
      }));
      expect(result.success).toBe(true);
    });

    it('should call resend with both customer and admin emails if both are present', async () => {
      const result = await sendReceiptEmail(mockSale, mockCustomer, 'admin@example.com');

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend).toHaveBeenNthCalledWith(1, expect.objectContaining({
        to: 'john@example.com',
        subject: expect.stringContaining('Receipt for Sale #123')
      }));
      expect(mockSend).toHaveBeenNthCalledWith(2, expect.objectContaining({
        to: 'admin@example.com',
        subject: expect.stringContaining('Receipt for Sale #123')
      }));
      expect(result.success).toBe(true);
    });

    it('should handle resend errors gracefully', async () => {
      mockSend.mockRejectedValue(new Error('API Error'));

      const result = await sendReceiptEmail(mockSale, mockCustomer);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
