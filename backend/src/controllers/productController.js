const productService = require('../services/productService');
const { sendSuccess, sendCreated } = require('../utils/responseHandler');
const ApiError = require('../utils/apiError');

/**
 * Product Controller – CRUD, status management, and ownership enforcement.
 */
const productController = {
  /**
   * POST /api/products
   */
  async create(req, res, next) {
    try {
      const product = await productService.create(req.user.id, req.body);
      return sendCreated(res, 'Product created successfully', product);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/products
   * Returns the authenticated seller's products with pagination.
   */
  async getMyProducts(req, res, next) {
    try {
      const { page, limit, status, sort, order } = req.query;
      const result = await productService.getBySeller(req.user.id, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status,
        sort: sort || 'created_at',
        order: order || 'desc',
      });

      return sendSuccess(res, 'Products retrieved successfully', {
        products: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.count,
          totalPages: Math.ceil((result.count || 0) / (parseInt(limit) || 20)),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/products/:id
   */
  async getById(req, res, next) {
    try {
      const product = await productService.getById(req.params.id);

      if (!product) {
        throw ApiError.notFound('Product not found');
      }

      // Non-published products can only be viewed by their owner or admins
      if (product.status !== 'published') {
        if (!req.user || (product.seller_id !== req.user.id && req.profile?.role !== 'admin')) {
          throw ApiError.notFound('Product not found');
        }
      }

      return sendSuccess(res, 'Product retrieved successfully', product);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/products/:id
   */
  async update(req, res, next) {
    try {
      // Verify ownership
      const existing = await productService.getById(req.params.id);
      if (!existing) {
        throw ApiError.notFound('Product not found');
      }
      if (existing.seller_id !== req.user.id && req.profile.role !== 'admin') {
        throw ApiError.forbidden('You can only update your own products');
      }

      const product = await productService.update(req.params.id, req.body);
      return sendSuccess(res, 'Product updated successfully', product);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/products/:id
   */
  async delete(req, res, next) {
    try {
      const existing = await productService.getById(req.params.id);
      if (!existing) {
        throw ApiError.notFound('Product not found');
      }
      if (existing.seller_id !== req.user.id && req.profile.role !== 'admin') {
        throw ApiError.forbidden('You can only delete your own products');
      }

      await productService.delete(req.params.id);
      return sendSuccess(res, 'Product deleted successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/products/:id/publish
   */
  async publish(req, res, next) {
    try {
      const existing = await productService.getById(req.params.id);
      if (!existing) throw ApiError.notFound('Product not found');
      if (existing.seller_id !== req.user.id && req.profile.role !== 'admin') {
        throw ApiError.forbidden('You can only publish your own products');
      }

      const product = await productService.updateStatus(req.params.id, 'published');

      // Publish domain event
      const eventBus = require('../events/eventBus');
      const EventTypes = require('../events/eventTypes');
      eventBus.publish(EventTypes.PRODUCT_PUBLISHED, {
        sellerId: product.seller_id,
        productId: product.id,
        productTitle: product.title,
      });

      return sendSuccess(res, 'Product published successfully', product);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/products/:id/draft
   */
  async draft(req, res, next) {
    try {
      const existing = await productService.getById(req.params.id);
      if (!existing) throw ApiError.notFound('Product not found');
      if (existing.seller_id !== req.user.id && req.profile.role !== 'admin') {
        throw ApiError.forbidden('You can only update your own products');
      }

      const product = await productService.updateStatus(req.params.id, 'draft');
      return sendSuccess(res, 'Product set to draft successfully', product);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = productController;
