const Resource = require('../models/Resource');
const paginate = require('../utils/paginate');

/**
 * GET /api/resources
 * Query params: type, available, search, page, limit, sort
 */
exports.getAll = async (req, res, next) => {
  try {
    const { type, available, search, sort = '-createdAt' } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (available !== undefined) filter.available = available === 'true';
    if (search) filter.$text = { $search: search };

    const query = Resource.find(filter).sort(sort);
    const result = await paginate(query, req.query);

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resources/:id
 */
exports.getOne = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Ressource introuvable.' });
    }
    res.json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/resources  [admin]
 */
exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) data.image = req.file.filename;

    const resource = await Resource.create(data);
    res.status(201).json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/resources/:id  [admin]
 */
exports.update = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) data.image = req.file.filename;

    const resource = await Resource.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Ressource introuvable.' });
    }

    res.json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/resources/:id  [admin]
 */
exports.remove = async (req, res, next) => {
  try {
    const resource = await Resource.findByIdAndDelete(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Ressource introuvable.' });
    }
    res.json({ success: true, message: 'Ressource supprimée avec succès.' });
  } catch (error) {
    next(error);
  }
};
