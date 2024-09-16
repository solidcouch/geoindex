describe('The service regularly crawls Things of its group members, and updates itself accordingly.', () => {
  it(
    'should go through all members and fresh-update the records of each member (remove all that is missing, add all that is available for each person)',
  )

  it(
    '[request goes 502] should make a note and ignore stuff, and if 502 lasts over multiple updates, remove the thing',
  )
})
