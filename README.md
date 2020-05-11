# cosopho-api


There are three parts to the COSOPHO project.

1. The API
2. The Dashboard
3. The Frontend site

You should install and set them up in the order shown above.

You will also need.

1. An Auth0 account
2. A Cloudinary account
3. ElasticSearch set up.

## Installation instructions

You should install this API first!

Steps

1. Check out this repo
2. Run `npm install`
3. Run `npm run build`
3. Setup your `.env` file, example shown below

**Running locally**, when you are running locally and the `NODE_ENV=development` is set to `development`, the code will automatically look for changes as you edit files and rebuild and restart if necessary.

If you don't want this behaviour use the `--skipBuild` command line parameter, i.e.

`npm run start -- --skipBuild`

When the app starts it will automatically open the brower, to stop it doing this use `--skipOpen` parameter.

You can combine both if you wish.

`npm run start -- --skipOpen --skipBuild`

If the app automatically restarts it may not always shut down properly, in this case you can kill it with the `kill` command. The process ID is stored in the `.pid` file.

`cat .pid`  
`kill -9 xxxxx` (where xxxxx is the number from the .pid file)

**Running remotely**, when you are running remotely you should set your `NODE_ENV=staging|production` to `staging` or `production`. You should also not let the app restart itself when it spots changes, there is no real harm in doing this, but it does mean "hot restarts" won't always be timely when using process managers.

You should make sure the app starts with the `--skipBuild` parameter, and make sure the build step is always run automatically.

i.e. update the code (through whatever deploy method you use) then make sure `npm run build` is executed to rebuild the app.

## .env file

You `.env` file should look something like this...

```
CALLBACK_URL=http://localhost:4000/callback
ELASTICSEARCH=http://localhost:9200
KEY=cosopho_001
SIGNEDID=asdasdasdasdasd
NODE_ENV=development
```

The `CALLBACK_URL` is used by Auth0 for it's call back. You need to make sure this url is registered with both the Auth0 **app** *and* **tenet** for logging in and out to work correctly.

`ELASTICSEARCH` is where your data is going to be stored.

`KEY` is used to _postfix_ the indexes in the ElasticSearch, for example, when you start up the app a `config_KEY` index will be created, in our example that would be `config_cosopho_001`. 

This is done so a number of Cosopho instances can be run on the same ElasticSearch cluster, you would end up with several `config_*` indexes, and `users_*` indexes etc.

`SIGNEDID`, this is the _unhashed_ version of the 'GOD' API signing token. You can piut whatever value you want into here, when the app starts it will output the Admin sessionId into the logs, it will look like this...

```
-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

                 SERVER STARTED

           Everything is up and running

    The process id for the server is 52764, use
                 'kill -9 52764'
         should you wish to force stop it
Admin sessionId: abcdef0123456789abcdef0123456789

-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
```

The front-end needs two API key values, the `TOKEN` and the `SIGNATURE`, the `TOKEN` you will get from the dashboard when you set it up, but the `SIGNATURE` comes from here.

If you need to "rotate" the `SIGNATURE` then update the `SIGNEDID`, restart the app, and grab the new `SIGNATURE` from the logs.

`NODE_ENV=development` This will be set to `development`, `staging` or `production`. `development` only effects that "watcher" looking for files that have been changed so it can "hot-ish" reload.

`staging` and `production` both won't watch for file changes, other than that the only difference is the level of logging that happens.

[SPOILER: currently there is no difference between logging levels]

# Running and calling the API

When you have the API running either locally with `npm start -- --skipOpen` or remotely (magically), the first time you go to visit the site it will ask you for your Auth0 details.

There is also a `handshake` field, make a note of the handshake somewhere, it will come in handy. If you lose the handshake it can be found in the `config_[KEY]` index in ElasticSearch.

Once you enter the details the app will write those to the database and attempt to restart, locally this will probably be fine, but remotely you may need to manually restart the app.

You should only need to enter this information once, and once the app has restarted with the new information everything should be fine.

**The first person to log into the app will be given ADMIN privileges**

Once you've logged in, you will see a homepage that tells you what your API token is, and links to the Playground and the GRPAHQL end point.

The API token is broken down into two halves, for example

`abcdef0123456789abcdef0123456789-0123456789abcdef0123456789abcdef`

Cosopho is a photosharing app, there are two different types of users.

1. The users who log into the dashboard and set up all the instances, initiatives and so on.
2. The users who log into the site to upload the photos.

The two halves of the API token represent those two halves.

The first half is the `APP` API **token**. When a user logs into the **API** or the **dashboard** they are given a "default" API **token**. This **token** allows the user to make _read only_ calls to the API, and access to a limited range of public data.

If you were making a 3rd part app to _read_ photos from the API, then you would sign into the API (or dashboard) as a new user and get assigned an API **token**.

If your user role is switched to an **ADMIN** user, then your **token** becomes an **ADMIN** token, now you can create instances, and initiatives, read/write the translations and create/upload photos.

The `handshake` can also be used as an admin **token**, the API and the dashboard use the `handshake` to be able to write data to the database. So while you _can_ use the `handshake` as an API **token**, it's normally better to sign into the dashboard as a new user, set them as admin, and use their **token**, as you can easily delete the user if you need to revolk the API **token**.

The second half is the **signature** of the "scope" of the user (of the front-end) you are making the API call for.

When a user logs into the front end, a call is made to the API to get that user's **sessionID**, which is used to sign the API calls in that user's "scope".

If the front-end makes a call to the API signed with user '**A**'s **sessionID** it will return archived (private) photos for user '**A**', but if a call is signed with user '**B**'s **sessionID** they will not be able to see user '**A**'s archived (private) photos.

