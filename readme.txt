EE547 Homework 7 - Protein Motif Search API

Ran Zhang
3864207168

#1. Overview
    This is my submission for EE547 Homework #7. The goal was to build a RESTful API for protein motif search using Node.js and PostgreSQL. 
 The app allows users to submit protein sequences, and the system will automatically cut the sequence into overlapping fragments, 
 identify potential motifs within each fragment, and generate confidence scores for each match.
    All data is stored in a PostgreSQL database using a relational schema. I also implemented filtering, pagination, and regex-based motif search as required.
 Additionally, I added full validation for query parameters and proper error responses for bad requests (400), unauthorized access (401), 
 and missing resources (404) as specified in the assignment. Write operations are handled within transactions to maintain consistency. 
 Every API request must include a custom user ID for basic authentication.

#2. How to Run the Project
 2.1 Install dependencies
    npm install

 2.2 Create a `.env` file
    In the root of the project, I created a `.env` file to configure the PostgreSQL connection:
        PGHOST=localhost
        PGUSER=postgres
        PGPASSWORD=password
        PGDATABASE=protein_db
        PGPORT=5432
        PORT=3000

 2.3 Start the server
    node server.js
    The server should start on `http://localhost:3000`.

#3. How to Set Up the Database
 I used Docker to run PostgreSQL locally. Here's how I set it up:
 3.1 Start a PostgreSQL container
    docker run -d \
        --name postgres \
        -e POSTGRES_PASSWORD=password \
        -e POSTGRES_USER=postgres \
        -e POSTGRES_DB=protein_db \
        -p 5432:5432 \
        postgres:latest
    This starts a new PostgreSQL instance on port 5432, with a database named `protein_db`.

 3.2 Set up the schema
    Once the container is running, I copied the schema file into the container and executed it:
        docker cp db/schema.sql postgres:/schema.sql
        docker exec -it postgres psql -U postgres -d protein_db -f /schema.sql
    This creates all the tables needed for the app to run.

#4. API Testing
 Before running any curl commands, export the following environment variables:

    export BASE_URL="http://localhost:3000"
    export USER_ID="user-001"

 These are used in all curl commands below. Replace them if necessary.

 4.1 Create a protein
   curl -i -X POST $BASE_URL/api/proteins \
      -H "X-User-ID: $USER_ID" \
      -H "Content-Type: application/json" \
      -d '{
         "name": "TestProtein",
         "description": "Protein for testing",
         "molecularWeight": 60000,
         "sequence": "ACDEFGHIKLMNPQRSTVWYACDEFGHIKLMNPQRSTVWY"
      }'

 4.2 Get all proteins (paginated)
   curl -i -X GET "$BASE_URL/api/proteins?limit=5&offset=0" \
      -H "X-User-ID: $USER_ID"

 4.3 Pagination boundary test (high offset, empty result)
   curl -i -X GET "$BASE_URL/api/proteins?limit=5&offset=9999" \
      -H "X-User-ID: $USER_ID"

 4.4 Get fragments for a protein
   curl -i -X GET $BASE_URL/api/proteins/<proteinId>/fragments \
      -H "X-User-ID: $USER_ID"

 4.5 Get a single fragment by ID
   curl -i -X GET $BASE_URL/api/proteins/fragments/<fragmentId> \
      -H "X-User-ID: $USER_ID"

 4.6 Search proteins by name or motif
   curl -i -G "$BASE_URL/api/proteins/search" \
      -H "X-User-ID: $USER_ID" \
      --data-urlencode "name=Test"

   curl -i -G "$BASE_URL/api/proteins/search" \
      -H "X-User-ID: $USER_ID" \
      --data-urlencode "motif=N[^P][ST][^P]"

   curl -i -G "$BASE_URL/api/proteins/search" \
      -H "X-User-ID: $USER_ID" \
      --data-urlencode "motif=[ST].{2}[DE]"

 4.7 Search proteins with filters and sort
   curl -i -G "$BASE_URL/api/proteins/search" \
      -H "X-User-ID: $USER_ID" \
      --data-urlencode "molecularWeight[gt]=40000" \
      --data-urlencode "molecularWeight[lte]=70000"

   curl -i -G "$BASE_URL/api/proteins/search" \
      -H "X-User-ID: $USER_ID" \
      --data-urlencode "sequenceLength[lte]=100" \
      --data-urlencode "sort=sequenceLength:desc"

 4.8 Error handling tests

   //Input validation (400 Bad Request)**
      - Missing name:
         curl -i -X POST $BASE_URL/api/proteins \
            -H "X-User-ID: $USER_ID" \
            -H "Content-Type: application/json" \
            -d '{
               "description": "Missing name",
               "molecularWeight": 50000,
               "sequence": "ACDEFGHIKLMNPQRSTVWY"
            }'

      - Name too long (>100 chars):
         curl -i -X POST $BASE_URL/api/proteins \
            -H "X-User-ID: $USER_ID" \
            -H "Content-Type: application/json" \
            -d '{
               "name": "'"$(printf 'A%.0s' {1..101})"'",
               "description": "Name too long",
               "molecularWeight": 50000,
               "sequence": "ACDEFGHIKLMNPQRSTVWY"
            }'

      - Name = 100 characters (edge case):
         curl -i -X POST $BASE_URL/api/proteins \
            -H "X-User-ID: $USER_ID" \
            -H "Content-Type: application/json" \
            -d '{
               "name": "'"$(printf 'A%.0s' {1..100})"'",
               "description": "Edge case: name length 100",
               "molecularWeight": 50000,
               "sequence": "ACDEFGHIKLMNPQRSTVWY"
            }'

      - Sequence exceeds 2000 characters:
         curl -i -X POST $BASE_URL/api/proteins \
            -H "X-User-ID: $USER_ID" \
            -H "Content-Type: application/json" \
            -d '{
               "name": "TooLongSequence",
               "molecularWeight": 50000,
               "sequence": "'"$(head -c 2001 < /dev/zero | tr '\0' A)"'"
            }'

      - Invalid amino acid characters:
         curl -i -X POST $BASE_URL/api/proteins \
            -H "X-User-ID: $USER_ID" \
            -H "Content-Type: application/json" \
            -d '{
               "name": "BadSequence",
               "molecularWeight": 50000,
               "sequence": "ACDE1234xyz"
            }'

      - Negative molecular weight:
         curl -i -X POST $BASE_URL/api/proteins \
            -H "X-User-ID: $USER_ID" \
            -H "Content-Type: application/json" \
            -d '{
               "name": "NegativeWeight",
               "molecularWeight": -10,
               "sequence": "ACDEFGHIKLMNPQRSTVWY"
            }'

 4.9 Authentication and authorization errors (401)
   - Missing `X-User-ID`:
      curl -i -X GET $BASE_URL/api/proteins

   - Invalid `X-User-ID`:
      curl -i -X GET $BASE_URL/api/proteins \
         -H "X-User-ID: invalid-user"


 4.10 Invalid search parameters
   - Invalid motif pattern:
      curl -i -G $BASE_URL/api/proteins/search \
         -H "X-User-ID: $USER_ID" \
         --data-urlencode "motif=***INVALID"

   - Invalid range operator:
      curl -i -G $BASE_URL/api/proteins/search \
         -H "X-User-ID: $USER_ID" \
         --data-urlencode "molecularWeight[xyz]=1000"

 4.11 Missing resource tests (404)
   - Fragment not found:
      curl -i -X GET $BASE_URL/api/proteins/fragments/00000000-0000-0000-0000-000000000000 \
         -H "X-User-ID: $USER_ID"

   - Protein not found:
      curl -i -X GET $BASE_URL/api/proteins/00000000-0000-0000-0000-000000000000/fragments \
         -H "X-User-ID: $USER_ID"

#5. Project Structure
    .
    ├── db/
    │   └── schema.sql               # PostgreSQL schema definition
    ├── routes/
    │   └── proteins.js              # All API route handlers
    │   └── fragments.js             
    ├── utils/
    │   └── fragmenter.js            # Logic for slicing and motif detection
    ├── server.js                    # App entry point
    ├── .env                         # Environment variables (not submitted)
    ├── package.json
    └── README.md
    ```
