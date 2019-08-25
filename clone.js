const fs = require('fs');
const https = require('https');
const path = require('path');
const process = require('process');
let dir = path.join(__dirname, 'clones');
const mirror_dir = path.join(__dirname, 'mirrors');
const { spawn } = require('child_process');

if (![3,4].includes(process.argv.length)) {
  console.log('Incorrect number of arguments.\nUsage:\nnode clone.js ACCESS_TOKEN [MIRROR]');
  return -1;
}

const GITHUB_BASE_URL = 'api.github.com';
const ACCESS_TOKEN = process.argv[2];
const ORG_NAME = 'MY_ORG_NAME';
const MAX_RESULTS = 100; // API only allows a max of 100 per page
const MIRROR = (process.argv.length === 4) ? ((process.argv[3] === 'mirror') ? true : false) : false;

if (MIRROR) {
  if (!fs.existsSync(mirror_dir)) {
    fs.mkdirSync(mirror_dir);
  }
  dir = mirror_dir;
} else if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

const local = b => b.substring(b.lastIndexOf('/')+1).replace('*','').trim();

const rmdir = function(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function(file, idx){
      var curr = path + "/" + file;
      if (fs.lstatSync(curr).isDirectory()) {
        rmdir(curr);
      } else { // delete file
        fs.unlinkSync(curr);
      }
    });
    fs.rmdirSync(path);
  }
};

const reset = async (project) => {
  return new Promise((resolve, reject) => {
    let params = ['reset', '--hard', 'HEAD'];

    let opts = {cwd: path.join(dir, project.name)};

    let process = spawn('git', params, opts);
    process.stdout.on('data', data => {
      console.log(`${data}`);
    });
    process.stderr.on('data', data => {
      console.log(`${data}`);
    });
    process.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        console.log(`${project.name} exit code : ${code}`);
        reject();
      }
    });
  })
  .catch(error => {
    console.log(error);
  });
};

const checkout = async (project, branch, force = false) => {
  return new Promise((resolve, reject) => {
    let params = ['checkout', branch];
    if (force)
      params = [...params, '-f'];

    let opts = {cwd: path.join(dir, project.name)};

    let process = spawn('git', params, opts);
    process.stdout.on('data', data => {
      console.log(`${data}`);
    });
    process.stderr.on('data', data => {
      console.log(`${data}`);
    });
    process.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        console.log(`${project.name} exit code : ${code}`);
        reject();
      }
    });
  })
  .catch(error => {
    console.log(error);
  });
};

const branch = async (project, mode = 'tracked', remote = null) => {
  let branches = [];
  return new Promise((resolve, reject) => {
    let opts = {cwd: path.join(dir, project.name)};
    let params = ['branch'];

    switch (mode) {
      case 'all':
        params = [...params, '-r', '--sort=-committerdate'];
        break;
      case 'track-new':
        params = [...params, '--track', remote.split('/').pop(), remote];
        break;
    }

    let process = spawn('git', params, opts);
    process.stdout.on('data', data => {
      if (mode !== 'track-new') {
        let remotes = data.toString('utf8').split(/\r\n|\r|\n/);
        (async () => {
          for (const r of remotes) {
            let b = r.trim();
            if (!(b.includes('->') || b.includes('master') || b.includes('for-each-ref') || b.length == 0))
              branches.push(b);
          }
        })();
      } else {
        console.log(`${data}`);
      }
    });
    process.stderr.on('data', data => {
      console.log(`${data}`);
    });
    process.on('close', code => {
      if (code === 0) {
        resolve(branches);
      } else {
        console.log(`${project.name} exit code : ${code}`);
        reject();
      }
    });
  })
  .catch(error => {
    console.log(error);
  });
};

const update = async (project, mode) => {
  return new Promise((resolve, reject) => {
    let opts = {};
    let params = [mode, '--recurse-submodules', '--jobs=4'];
    let cwd = path.join(dir, project.name);

    switch (mode) {
      case 'clone':
        params = [ ...params,  ...((MIRROR) ? ['--mirror'] : []), project.clone_url, cwd ];
        break;
      case 'pull':
        params = [ ...params, '--all' ];
        opts = { cwd };
        break;
      case 'fetch':
        params = [ ...params, '--all' ];
        opts = { cwd };
        break;
    }

    let process = spawn('git', params, opts);
    process.stdout.on('data', data => {
      if (mode !== 'fetch')
        console.log(`${data}`);
    });
    process.stderr.on('data', data => {
      console.log(`${data}`);
    });
    process.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        console.log(`${project.name} exit code : ${code}`);
        reject();
      }
    });
  })
  .catch(error => {
    console.log(error);
  });
};

const getProjects = ({projects,page}) => {
  projects = projects || [];
  page = page || 1;
  
  let opts = {
    host: `${GITHUB_BASE_URL}`,
    path: `/orgs/${ORG_NAME}/repos?access_token=${ACCESS_TOKEN}&page=${page}&per_page=${MAX_RESULTS}`,
    method: 'GET',
    headers: { 'user-agent': 'node.js' }
  };

  const req = https.request(opts, function (res) {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      let page_projects = JSON.parse(body);
      projects = [...projects, ...page_projects];

      (async () => {
        for (const p of projects) {
          let cwd = path.join(dir,p.name);
          console.log(`${cwd}\n${p.name} ${(p.language != null) ? '- ' + p.language : ''} (${(p.size/1024).toFixed(2)} MB)...` );

          if (MIRROR) {
            if (fs.existsSync(cwd)) {
              rmdir(cwd);
            }
          }

          if (!fs.existsSync(cwd) || MIRROR) {
            await update(p, 'clone');
          }
          
          if (!MIRROR) {
            let branches = await branch(p, 'all');
            let tracked = await branch(p, 'tracked');
            let untracked = branches.filter(b => !tracked.map(t=>local(t).toLowerCase()).includes(local(b).toLowerCase()));
            
            if (untracked.length > 0) { console.log('Adding remote branches ...'); }

            for (const u of untracked) {
              console.log('checking out new branch:'+ u);
              await branch(p, 'track-new', u);
            }
            await reset(p);
            await update(p, 'fetch');

            if (branches.length === 0) {
              await checkout(p, 'master');
            } else {
              await checkout(p, local(branches[0]), true);
            }
            await update(p, 'pull');
          }
        }
        if (page_projects.length%MAX_RESULTS==0) {
          getProjects({projects, page: ++page});
        };
      })();

    });
  }).on('error', (e) => {
    console.log(e);
  });
  req.end();
  return projects;
};

getProjects({});
