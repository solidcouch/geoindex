describe('Group members can query service for Things at certain geohash, using Triple Pattern Fragment', () => {
  context('group member', () => {
    it('should respond with things at given geohash')
  })

  context('not a group member', () => {
    it('should return 403')
  })

  context('not authenticated', () => {
    it('should return 401')
  })
})
