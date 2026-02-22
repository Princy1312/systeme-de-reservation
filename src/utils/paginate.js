/**
 * Pagination helper
 * @param {Object} query - Mongoose query object
 * @param {Object} reqQuery - req.query object
 * @returns {{ data, pagination }}
 */
const paginate = async (query, reqQuery) => {
  const page = Math.max(1, parseInt(reqQuery.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(reqQuery.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const total = await query.model.countDocuments(query.getFilter());
  const data = await query.skip(skip).limit(limit);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
};

module.exports = paginate;
