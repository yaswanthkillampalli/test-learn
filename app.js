const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const app = express()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

app.use(express.json())

const middleWare = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, 'SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  } else {
    response.status(401)
    response.send('Invalid JWT Token')
  }
}

app.post('/login', async (request, response) => {
  const {username = '', password = ''} = request.body
  const query = `SELECT * FROM user WHERE username='${username}'`
  const result = await db.get(query)
  if (result === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const verify = await bcrypt.compare(password, result.password)
    if (verify) {
      const payload = {
        username,
      }
      const jwtToken = jwt.sign(payload, 'SECRET_TOKEN')
      response.status(200)
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', middleWare, async (request, response) => {
  const query = `
  SELECT 
  state_id as stateId,
  state_name as stateName,
  population
  FROM
  state
  `
  const dbResponse = await db.all(query)
  response.send(dbResponse)
})

app.get('/states/:stateId', middleWare, async (request, response) => {
  const {stateId} = request.params
  const query = `
  SELECT 
  state_id as stateId,
  state_name as stateName,
  population
  FROM
  state
  WHERE
  state_id = ${stateId}
  `
  const dbResponse = await db.get(query)
  response.send(dbResponse)
})

app.post('/districts', middleWare, async (request, response) => {
  const districtData = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtData
  const query = `
  INSERT INTO
  district(district_name,state_id,cases,cured,active,deaths)
  VALUES (
    '${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths}
  )
  `
  await db.run(query)
  response.send('District Successfully Added')
})

app.get('/districts/:districtId', middleWare, async (request, response) => {
  const {districtId} = request.params
  const query = `
  SELECT
  district_id as districtId,
  district_name as districtName,
  state_id as stateId,
  cases,
  cured,
  active,
  deaths
  FROM
  district
  WHERE
  district_id = ${districtId};
  `
  const dbResponse = await db.get(query)
  response.send(dbResponse)
})
app.delete('/districts/:districtId', middleWare, async (request, response) => {
  const {districtId} = request.params
  const query = `
  DELETE FROM 
  district
  WHERE
  district_id = ${districtId};
  `
  await db.run(query)
  response.send('District Removed')
})

app.put('/districts/:districtId', middleWare, async (request, response) => {
  const {districtId} = request.params
  const districtData = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtData
  const query = `
  UPDATE
    district
  SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
  WHERE
    district_id = ${districtId};
  `
  await db.run(query)
  response.send('District Details Updated')
})

app.get('/states/:stateId/stats/', middleWare, async (request, response) => {
  const {stateId} = request.params
  const query = `
  SELECT
  SUM(cases) as totalCases,
  SUM(cured) as totalCured,
  SUM(active) as totalActive,
  SUM(deaths) as totalDeaths
  FROM
  district
  WHERE
  state_id = ${stateId};
  `
  const dbResponse = await db.get(query)
  response.send(dbResponse)
})

app.get(
  '/districts/:districtId/details/',
  middleWare,
  async (request, response) => {
    const {districtId} = request.params
    const query = `
  SELECT
  state.state_name as stateName
  FROM
  state JOIN district ON state.state_id = district.state_id
  WHERE 
  district.district_id = ${districtId};
  `
    const dbResponse = await db.get(query)
    response.send(dbResponse)
  },
)

module.exports = app
