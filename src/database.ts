import {
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
  type Options,
  Sequelize,
} from 'sequelize'

export class Thing extends Model<
  InferAttributes<Thing>,
  InferCreationAttributes<Thing>
> {
  declare uri: string
  declare geohash: string
}

export const initializeDatabase = async (database: Options) => {
  const sequelize = new Sequelize({
    logging: false,
    ...database,
  })

  Thing.init(
    {
      uri: { type: DataTypes.STRING(), allowNull: false, unique: true },
      geohash: { type: DataTypes.STRING(10), allowNull: false },
    },
    {
      sequelize,
      indexes: [
        {
          name: 'geohash_index',
          fields: ['geohash'],
          using: 'BTREE',
        },
      ],
    },
  )

  await sequelize.sync()
}
