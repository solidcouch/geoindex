import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'
import { database } from './config'

const sequelize = new Sequelize({
  logging: false,
  ...database,
})

export class Thing extends Model<
  InferAttributes<Thing>,
  InferCreationAttributes<Thing>
> {
  declare uri: string
  declare geohash: string
}

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

sequelize.sync()
