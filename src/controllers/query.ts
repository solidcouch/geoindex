import { Middleware } from 'koa'
import { DataFactory, Quad, Writer } from 'n3'
import { Op } from 'sequelize'
import { Thing } from '../database'

export const queryThings: Middleware = async ctx => {
  const objectRaw = ctx.query.object

  const geohash =
    typeof objectRaw === 'string' ? objectRaw.replaceAll('"', '') : ''

  const things = await Thing.findAll({
    where: { geohash: { [Op.like]: geohash + '%' } },
  })

  const { quad, literal, namedNode } = DataFactory
  const geohashPredicate = namedNode('https://example.com/ns#geohash')

  const quads: Quad[] = things.flatMap(thing => {
    const thingNode = namedNode(thing.uri)
    return [
      quad(thingNode, geohashPredicate, literal(geohash)),
      quad(thingNode, geohashPredicate, literal(thing.geohash)),
    ]
  })

  ctx.body = await rdfToString(quads)
  ctx.status = 200
  ctx.headers['content-type'] = 'text/turtle'
}

const rdfToString = async (
  quads: Quad[],
  contentType: 'text/turtle' = 'text/turtle',
): Promise<string> => {
  const writer = new Writer({ format: contentType })
  writer.addQuads(quads)
  return new Promise((resolve, reject) =>
    writer.end((err, result) => {
      if (err) reject(err)
      else resolve(result)
    }),
  )
}
