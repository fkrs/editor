(function(pkg) {
  // Expose a require for our package so scripts can access our modules
  window.require = Require.generateFor(pkg);
})({
  "source": {
    "TODO": {
      "path": "TODO",
      "mode": "100644",
      "content": "TODO\n----\nBundled Dependencies\n- Build bundled dependencies into published script\n- Dependency source should not be in revision control\n- requires and module.exports\n- inter-component and intra-component dependencies\n- One day we'll need to implement a bundleresque system, but not today\n\nLive Update Demo\n- Hot reload css\n- Display Demo Runtime Errors in console\n\nOpen published page in editor and run live demo with same state as when editor was opened\n- Pass git repo/branch metadata to published page for use in editor\n\nPersist state across demo reloads\n\nOrganize File tree by type\nFile icons\n\nDisplay Diffs\n\nFirst auth doesn't display in bar\n\nCache Git trees and files in some form of local storage\n\nSometimes editor appears blank when switching files\n\nEditor plugins\n- static analysis\n- find in files\n- source file hygiene\n",
      "type": "blob"
    },
    "editor.coffee.md": {
      "path": "editor.coffee.md",
      "mode": "100644",
      "content": "Editor\n======\n\n    Runner = require(\"runner\")\n    Actions = require(\"./source/actions\")\n    Builder = require(\"builder\")\n    Packager = require(\"packager\")\n    {Filetree, File} = require(\"filetree\")\n\n    initBuilder = ->\n      builder = Builder()\n\n      # Add editor's metadata\n      builder.addPostProcessor (pkg) ->\n        pkg.progenitor =\n          url: \"http://strd6.github.io/editor/\"\n\n      # Add metadata from our config\n      builder.addPostProcessor (pkg) ->\n        config = readSourceConfig(pkg)\n\n        pkg.version = config.version\n        pkg.entryPoint = config.entryPoint or \"main\"\n        pkg.remoteDependencies = config.remoteDependencies\n\n      return builder\n\n    module.exports = (I={}, self=Model(I)) ->\n      runner = Runner()\n      builder = initBuilder()\n      filetree = Filetree()\n\n      self.extend\n        repository: Observable()\n\nBuild the project, returning a promise that will be fulfilled with the `pkg`\nwhen complete.\n\n        build: ->\n          data = filetree.data()\n\n          builder.build(data)\n          .then (pkg) ->\n            config = readSourceConfig(pkg)\n\n            # TODO: Robustify bundled dependencies\n            # Right now we're always loading them from remote urls during the\n            # build step. The default http caching is probably fine to speed this\n            # up, but we may want to look into keeping our own cache during dev\n            # in addition to using the package's existing dependencies rather\n            # than always updating\n            dependencies = config.dependencies or {}\n\n            # TODO: We will want a more robust dependency cache instead of just\n            # grabbing our own package's dependencies\n            Packager.collectDependencies(dependencies, PACKAGE.dependencies)\n            .then (dependencies) ->\n              pkg.dependencies = dependencies\n\n              return pkg\n\n        save: ->\n          self.repository().commitTree\n            tree: filetree.data()\n\n        loadFiles: (fileData) ->\n          filetree.load fileData\n\nCurrently we're exposing the filetree though in the future we shouldn't be.\n\n        filetree: ->\n          filetree\n\n        files: ->\n          filetree.files()\n\n        fileAt: (path) ->\n          self.files().select (file) ->\n            file.path() is path\n          .first()\n\n        fileContents: (path) ->\n          self.fileAt(path)?.content()\n\n        filesMatching: (expr) ->\n          self.files().select (file) ->\n            file.path().match expr\n\n        writeFile: (path, content) ->\n          if existingFile = self.fileAt(path)\n            existingFile.content(content)\n\n            return existingFile\n          else\n            file = File\n              path: path\n              content: content\n\n            filetree.files.push(file)\n\n            return file\n\nLikewise we shouldn't expose the builder directly either.\n\n        builder: ->\n          builder\n\n        config: ->\n          readSourceConfig(source: arrayToHash(filetree.data()))\n\n        # TODO: Don't expose this, instead expose things like `runDocs`, `runTests`, etc.\n        runner: ->\n          runner\n\nRun some code in a sandboxed popup window. We need to popup the window immediately\nin response to user input to prevent pop-up blocking so we also pass a promise\nthat will contain the content to render in the window. If the promise fails we\nauto-close the window.\n\n        runInSandboxWindow: (config, promise) ->\n          sandbox = runner.run\n            config: config\n\n          promise.then(\n            (content) ->\n              sandbox.document.open()\n              sandbox.document.write(content)\n              sandbox.document.close()\n            , (error) ->\n              sandbox.close()\n\n              return error\n          )\n\n      self.include(Actions)\n\n      # TODO: Merge this in and clean up the `initBuilder` code\n      # Attach repo metadata to package\n      builder.addPostProcessor (pkg) ->\n        repository = self.repository()\n        # TODO: Track commit SHA as well\n        pkg.repository = repository.toJSON()\n\n        # Add publish branch\n        pkg.repository.publishBranch = self.config().publishBranch or repository.publishBranch()\n\n        pkg\n\n      return self\n\nHelpers\n-------\n\n    {readSourceConfig, arrayToHash} = require(\"./source/util\")\n",
      "type": "blob"
    },
    "lib/converter.coffee.md": {
      "path": "lib/converter.coffee.md",
      "mode": "100644",
      "content": "Converter\n=========\n\nHandle converting binary data from files into `json`.\n\n    module.exports = self =\n      convertDataToJSON: ({editor, outputFileName, matcher, mimeType}={}) ->\n        outputFileName ?= \"sounds.json\"\n        matcher ?= /^sounds\\/(.*)\\.wav$/\n        mimeType ?= \"audio/wav\"\n\n        # Gather image data from images/\n        imageFiles = editor.filesMatching(matcher)\n\n        fileData = self.convert imageFiles.map (file) ->\n          path: file.path()\n          content: file.content()\n          mimeType: mimeType\n          replacer: matcher\n\n        # Delete files in images/\n        imageFiles.forEach (file) ->\n          editor.files().remove(file)\n\n        # Create/update images.json\n        # Read file if it exists\n        try\n          existingData = JSON.parse(editor.fileContents(outputFileName))\n        catch\n          existingData = {}\n\n        # Merge data\n        Object.extend existingData, fileData\n\n        # Write file\n        editor.writeFile(outputFileName, JSON.stringify(existingData, null, 2))\n\n      convert: (fileData) ->\n        fileData.reduce (hash, {path, content, mimeType, replacer}) ->\n          path = path.replace(replacer, \"$1\")\n          hash[path] = \"data:#{mimeType};base64,#{btoa(content)}\"\n\n          hash\n        , {}\n",
      "type": "blob"
    },
    "main.coffee.md": {
      "path": "main.coffee.md",
      "mode": "100644",
      "content": "Editor\n======\n\nThe funny story about this editor is that it has an unbroken history from a\nsingle gist https://gist.github.com/STRd6/6286182/6196ffb39db7d10c56aa263190525318ca609db7\n\nThe original gist was an exploration in a self-hosting gist editor. One that\ncould load gists via the Github API, update them, and create new gists. It\nsucceeded at that, but I ran into the limits of the gist structure, namely no\nbranches or folders.\n\nI went on and created a git repo, merged in the gist history, and continued from\nthere. Maybe if I were smarter I could have rewritten it from scratch to be better,\nbut I had no idea what I was doing and still don't know to this day.\n\nSo that may explain why this is in such need of a cleanup.\n\nDemo\n----\n\n[Run it!](/editor)\n\nComponents\n----------\n\n- [Packager](/packager/docs)\n- [Hygiene](/hygiene/docs)\n- [Runtime](/runtime/docs)\n\nTODO: This needs a big cleanup.\n\n    # Get stuff from our package\n    {source:files} = PACKAGE\n\n    global.Sandbox = require 'sandbox'\n    require \"./source/duct_tape\"\n    require \"./source/deferred\"\n    {processDirectory} = require \"./source/util\"\n\n    global.PACKAGE = PACKAGE\n    global.require = require\n\n    # Create and auth a github API\n    # Global until we consolidate editor/actions into something cleaner\n    global.github = require(\"github\")(require(\"./source/github_auth\")())\n\nTemplates\n---------\n\n- [Actions](./templates/actions)\n- [Editor](./templates/editor)\n- [Github Status](./templates/github_status)\n- [Text Editor](./templates/text_editor)\n- [Repo Info](./templates/repo_info)\n\n    # Load and attach Templates\n    templates = (HAMLjr.templates ||= {})\n    [\n      \"actions\"\n      \"editor\"\n      \"github_status\"\n      \"text_editor\"\n      \"repo_info\"\n    ].each (name) ->\n      template = require(\"./templates/#{name}\")\n      # TODO Transitional type check\n      if typeof template is \"function\"\n        templates[name] = template\n\n    Editor = require(\"./editor\")\n    TextEditor = require(\"./source/text_editor\")\n\n    editor = global.editor = Editor()\n    editor.loadFiles(files)\n\n    # TODO: Don't expose these\n    builder = editor.builder()\n    filetree = editor.filetree()\n\n    {File, template:filetreeTemplate} = require \"filetree\"\n    templates[\"filetree\"] = filetreeTemplate\n\n    Hygiene = require \"hygiene\"\n    Runtime = require \"runtime\"\n    Packager = require \"packager\"\n\n    {readSourceConfig} = require(\"./source/util\")\n\n    notifications = require(\"notifications\")()\n    templates.notifications = notifications.template\n    {classicError, notify, errors} = notifications\n\n    Runtime(PACKAGE)\n      .boot()\n      .applyStyleSheet(require('./style'))\n\n    $root = $(\"body\")\n\n    # Branch Chooser using pull requests\n    {models:{Issue, Issues}, templates:{issues:issuesTemplate}} = require(\"issues\")\n    templates[\"issues\"] = issuesTemplate\n    issues = Issues()\n\n    # Github repository observable\n    # TODO: Finalize move into editor module\n    repository = editor.repository\n\n    repository.observe (repository) ->\n      issues.repository = repository\n      repository.pullRequests().then issues.reset\n\n      notify \"Loaded repository: #{repository.full_name()}\"\n\n    PACKAGE.repository.url ||= \"repos/#{PACKAGE.repository.full_name}\"\n\n    repository github.Repository(PACKAGE.repository)\n\n    confirmUnsaved = ->\n      Deferred.ConfirmIf(filetree.hasUnsavedChanges(), \"You will lose unsaved changes in your current branch, continue?\")\n\n    closeOpenEditors = ->\n      root = $root.children(\".main\")\n      root.find(\".editor-wrap\").remove()\n\n    actions =\n      save: ->\n        notify \"Saving...\"\n\n        editor.save()\n        .then ->\n          # TODO: This could get slightly out of sync if there were changes\n          # during the async call\n          # The correct solution will be to use git shas to determine changed status\n          # but that's a little heavy duty for right now.\n          filetree.markSaved()\n\n          editor.publish()\n        .then ->\n          notify \"Saved and published!\"\n        .fail (args...) ->\n          errors args\n\n      run: ->\n        notify \"Running...\"\n\n        editor.run()\n        .fail classicError\n\n      test: ->\n        notify \"Running tests...\"\n\n        editor.test()\n        .fail errors\n\n      docs: ->\n        notify \"Running Docs...\"\n\n        if file = prompt(\"Docs file\", \"index\")\n          editor.runDocs({file})\n          .fail errors\n\n      convert_data: ->\n        converter = require(\"./lib/converter\").convertDataToJSON\n\n        converter\n          editor: editor\n          outputFileName: \"images.json\"\n          matcher: /^images\\/(.*)\\.png$/\n          mimeType: \"image/png\"\n\n        converter\n          editor: editor\n          outputFileName: \"sounds.json\"\n          matcher: /^sounds\\/(.*)\\.wav$/\n          mimeType: \"audio/wav\"\n\n        converter\n          editor: editor\n          outputFileName: \"music.json\"\n          matcher: /^sounds\\/(.*)\\.mp3$/\n          mimeType: \"audio/mp3\"\n\n      new_file: ->\n        if name = prompt(\"File Name\", \"newfile.coffee\")\n          file = File\n            path: name\n            content: \"\"\n          filetree.files.push file\n          filetree.selectedFile file\n\n      load_repo: (skipPrompt) ->\n        confirmUnsaved()\n        .then ->\n          currentRepositoryName = repository().full_name()\n\n          fullName = prompt(\"Github repo\", currentRepositoryName)\n\n          if fullName\n            github.repository(fullName).then repository\n          else\n            Deferred().reject(\"No repo given\")\n        .then (repositoryInstance) ->\n          notify \"Loading files...\"\n\n          editor.load\n            repository: repositoryInstance\n          .then ->\n            closeOpenEditors()\n\n            notifications.push \"Loaded\"\n        .fail classicError\n\n      new_feature: ->\n        if title = prompt(\"Description\")\n          notify \"Creating feature branch...\"\n\n          editor.repository().createPullRequest\n            title: title\n          .then (data) ->\n            issue = Issue(data)\n            issues.issues.push issue\n\n            # TODO: Standardize this like backbone or something\n            # or think about using deferreds in some crazy way\n            issues.silent = true\n            issues.currentIssue issue\n            issues.silent = false\n\n            notifications.push \"Created!\"\n          , classicError\n\n      pull_master: ->\n        confirmUnsaved()\n        .then( ->\n          notify \"Merging in default branch...\"\n          repository().pullFromBranch()\n        , classicError\n        ).then ->\n          notifications.push \"Merged!\"\n\n          branchName = repository().branch()\n          notifications.push \"\\nReloading branch #{branchName}...\"\n\n          editor.load\n            repository: repository()\n          .then ->\n            notifications.push \"Loaded!\"\n          .fail ->\n            classicError \"Error loading #{repository().url()}\"\n\n      pull_upstream: ->\n        confirmUnsaved()\n        .then( ->\n          notify \"Pulling from upstream master\"\n\n          upstreamRepo = repository().parent().full_name\n\n          github.repository(upstreamRepo)\n          .then (repository) ->\n            repository.latestContent()\n          .then (results) ->\n            files = processDirectory results\n            editor.loadFiles files\n\n        , classicError\n        ).then ->\n          notifications.push \"\\nYour code is up to date with the upstream master\"\n          closeOpenEditors()\n\n      tag_version: ->\n        notify \"Building...\"\n\n        editor.build()\n        .then (pkg) ->\n          version = \"v#{readSourceConfig(pkg).version}\"\n\n          notify \"Tagging version #{version} ...\"\n\n          repository().createRef(\"refs/tags/#{version}\")\n          .then ->\n            notifications.push \"Tagged #{version}\"\n          .then ->\n            notifications.push \"\\nPublishing...\"\n\n            # Force branch for jsonp wrapper\n            pkg.repository.branch = version\n\n            repository().publish Packager.standAlone(pkg), version\n          .then ->\n            notifications.push \"Published!\"\n\n        .fail classicError\n\n    filetree.selectedFile.observe (file) ->\n      return if file.binary?()\n\n      root = $root.children(\".main\")\n      root.find(\".editor-wrap\").hide()\n\n      if file.editor\n        file.editor.trigger(\"show\")\n      else\n        root.append(HAMLjr.render \"text_editor\")\n        file.editor = root.find(\".editor-wrap\").last()\n\n        switch file.path().extension()\n          when \"md\", \"coffee\", \"js\", \"styl\", \"cson\"\n            file.content Hygiene.clean file.content()\n\n        textEditor = TextEditor\n          text: file.content()\n          el: file.editor.find('.editor').get(0)\n          mode: file.mode()\n\n        file.editor.on \"show\", ->\n          file.editor.show()\n          textEditor.editor.focus()\n\n        textEditor.text.observe (value) ->\n          file.content(value)\n\n          # TODO May want to move this into a collection listener for all files\n          # in the filetree\n          if file.path().match(/\\.styl$/)\n            hotReloadCSS(file)\n\n    hotReloadCSS = ( (file) ->\n      try\n        css = styl(file.content(), whitespace: true).toString()\n\n      editor.runner().hotReloadCSS(css) if css\n    ).debounce(100)\n\n    issues?.currentIssue.observe (issue) ->\n      # TODO: Formalize this later\n      return if issues.silent\n\n      changeBranch = (branchName) ->\n        previousBranch = repository().branch()\n\n        confirmUnsaved()\n        .then ->\n          closeOpenEditors()\n\n          # Switch to branch for working on the issue\n          repository().switchToBranch(branchName)\n          .then ->\n            notifications.push \"\\nLoading branch #{branchName}...\"\n\n            editor.load\n              repository: repository()\n            .then ->\n              notifications.push \"Loaded!\"\n        , ->\n          # TODO: Issue will appear as being selected even though we cancelled\n          # To correctly handle this we may need to really beef up our observables.\n          # One possibility is to extend observables to full fledged deferreds\n          # which can be rejected by listeners added to the chain.\n\n          repository.branch(previousBranch)\n\n          classicError \"Error switching to #{branchName}, still on #{previousBranch}\"\n\n      if issue\n        notify issue.fullDescription()\n\n        changeBranch issue.branchName()\n      else\n        notify \"Default branch selected\"\n\n        changeBranch repository().defaultBranch()\n\n    $root\n      .append(HAMLjr.render \"editor\",\n        filetree: filetree\n        actions: actions\n        notifications: notifications\n        issues: issues\n        github: github\n        repository: repository\n      )\n\n    window.onbeforeunload = ->\n      if filetree.hasUnsavedChanges()\n        \"You have some unsaved changes, if you leave now you will lose your work.\"\n",
      "type": "blob"
    },
    "pixie.cson": {
      "path": "pixie.cson",
      "mode": "100644",
      "content": "version: \"0.3.0\"\nentryPoint: \"main\"\nwidth: 960\nheight: 800\nremoteDependencies: [\n  \"https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.5.2/underscore-min.js\"\n  \"https://cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js\"\n  \"https://code.jquery.com/jquery-1.10.1.min.js\"\n  \"https://d1n0x3qji82z53.cloudfront.net/src-min-noconflict/ace.js\"\n  \"http://www.danielx.net/tempest/javascripts/envweb-v0.4.5.js\"\n]\ndependencies:\n  builder: \"distri/builder:v0.3.2\"\n  cson: \"distri/cson:v0.1.0\"\n  issues: \"STRd6/issues:v0.2.0\"\n  sandbox: \"STRd6/sandbox:v0.2.0\"\n  notifications: \"STRd6/notifications:v0.2.0\"\n  md: \"STRd6/md:v0.3.2\"\n  github: \"STRd6/github:v0.4.2\"\n  hygiene: \"STRd6/hygiene:v0.2.0\"\n  runtime: \"distri/runtime:v0.3.0\"\n  packager: \"distri/packager:v0.5.2\"\n  filetree: \"STRd6/filetree:v0.3.0\"\n  runner: \"STRd6/runner:v0.2.0\"\n",
      "type": "blob"
    },
    "source/actions.coffee.md": {
      "path": "source/actions.coffee.md",
      "mode": "100644",
      "content": "Actions\n=======\n\nTrying to encapsulate our action button actions, but doing a poor job so far.\n\nSome dependencies.\n\n    Packager = require \"packager\"\n    {processDirectory} = require \"./util\"\n\n    documenter = require(\"md\")\n\nThe primary actions of the editor. This is a mixin that is included in the editor.\n\n    Actions = (I={}, self) ->\n      self.extend\n\n        run: ->\n          self.runInSandboxWindow self.config(),\n            self.build()\n            .then (pkg) ->\n              Packager.standAlone pkg\n            .then (files) ->\n              content = index(files)?.content\n\n        runDocs: ({file}) ->\n          file ?= \"index\"\n\n          self.runInSandboxWindow docsConfig,\n            self.build()\n            .then (pkg) ->\n              documenter.documentAll(pkg)\n            .then (docs) ->\n              script = docs.first()\n\n              path = script.path.split(\"/\")\n              path.pop()\n              path.push(\"#{file}.html\")\n              path = path.join(\"/\")\n\n              if file = findFile(path, docs)\n                file.content + \"<script>#{script.content}<\\/script>\"\n              else\n                \"Failed to find file at #{path}\"\n\n        publish: ->\n          self.build()\n          .then (pkg) ->\n            documenter.documentAll(pkg)\n            .then (docs) ->\n              # NOTE: This metadata is added from the builder\n              publishBranch = pkg.repository.publishBranch\n\n              # TODO: Don't pass files to packager, just merge them at the end\n              # TODO: Have differenty types of building (docs/main) that can\n              # be chosen in a config rather than hacks based on the branch name\n              repository = self.repository()\n              if repository.branch() is \"blog\" # HACK\n                self.repository().publish(docs, undefined, publishBranch)\n              else\n                self.repository().publish(Packager.standAlone(pkg, docs), undefined, publishBranch)\n\n        test: ->\n          self.runInSandboxWindow self.config(),\n            self.build()\n            .then (pkg) ->\n              Packager.testScripts(pkg)\n            .then (testScripts) ->\n              # TODO: Editor should not have to return runner to run tests.\n              html = self.runner().testsHtml(testScripts)\n\n        load: ({repository}) ->\n          repository.latestContent()\n          .then (results) ->\n            self.repository repository\n\n            files = processDirectory results\n            self.loadFiles files\n\n    module.exports = Actions\n\nHelpers\n-------\n\n    docsConfig =\n      width: 1280\n      height: 800\n\nGet the `index.html` from a list of files.\n\n    index = (files) ->\n      files.filter (file) ->\n        /index\\.html$/.test file.path\n      .first()\n\nFind a file in a list of files by path.\n\n    findFile = (path, files) ->\n      files.filter (file) ->\n        file.path is path\n      .first()\n\nProcess results returned from Github API.\n",
      "type": "blob"
    },
    "source/deferred.coffee.md": {
      "path": "source/deferred.coffee.md",
      "mode": "100644",
      "content": "Deferred\n========\n\nUse jQuery.Deferred to implement deferreds, but\nstay insulated by not blasting the $ all over our code\nthat doesn't really depend on jQuery\nThis let's us swap our our Deferred provider more easily later.\n\n    global.Deferred = $.Deferred\n\nA helper to return a promise that may be resolved or rejected by the passed\ncode block.\n\n    withDeferrence = (fn) ->\n      deferred = Deferred()\n\n      # TODO: This try catch may be useless from deferring the fn\n      try\n        fn.defer(deferred)\n      catch e\n        deferred.reject(e)\n\n      return deferred.promise()\n\nA deferred encapsulating a confirm dialog.\n\n    Deferred.Confirm = (message) ->\n      withDeferrence (deferred) ->\n        if window.confirm(message)\n          deferred.resolve()\n        else\n          deferred.reject()\n\nA deferred that may present a confirm dialog, but only if a certain condition is\nmet.\n\n    Deferred.ConfirmIf = (flag, message) ->\n      if flag\n        return Deferred.Confirm(message)\n      else\n        withDeferrence (deferred) ->\n          deferred.resolve()\n\nA deferred that encapsulates a conditional execution of a block that returns a\npromise. If the condition is met the promise returning block is executed,\notherwise the deferred is marked as resolved and the block is not executed.\n\n    Deferred.ExecuteIf = (flag, callback) ->\n      withDeferrence (deferred) ->\n        if flag\n          callback().then deferred.resolve\n        else\n          deferred.resolve()\n\nA touched up version of jQuery's `when`. Succeeds if all promises succeed, fails\nif any promise fails. Handles jQuery weirdness if only operating on one promise.\n\nTODO: We should think about the case when there are zero promises. Probably\nsucceed with an empty array for results.\n\n    Deferred.when = (promises) ->\n      $.when.apply(null, promises)\n      .then (results...) ->\n        # WTF: jQuery.when behaves differently for one argument than it does for\n        # two or more.\n        if promises.length is 1\n          results = [results]\n        else\n          results\n",
      "type": "blob"
    },
    "source/duct_tape.coffee.md": {
      "path": "source/duct_tape.coffee.md",
      "mode": "100644",
      "content": "Duct Tape\n=========\n\nHere we have simple extension and utility methods that should be moved into our framework's environment libraries.\n\n`String#dasherize` should be moved into inflecta.\n\nConvert a string with spaces and mixed case into all lower case with spaces replaced with dashes. This is the style that Github branch names are commonly in.\n\n    String::dasherize = ->\n      @trim()\n        .replace(/\\s+/g, \"-\")\n        .toLowerCase()\n\nAdds a `render` helper method to HAMLjr. This should work it's way back into the\nHAMLjr runtime.\n\n`render` Looks up a template and renders it with the given object.\n\n    HAMLjr.render = (templateName, object) ->\n      templates = HAMLjr.templates\n      template = templates[templateName] or templates[\"templates/#{templateName}\"]\n\n      if template\n        template(object)\n      else\n        throw \"Could not find template named #{templateName}\"\n",
      "type": "blob"
    },
    "source/github_auth.coffee.md": {
      "path": "source/github_auth.coffee.md",
      "mode": "100644",
      "content": "A helper to capture client side authorization codes and send them to our gatekeeper\nserver to authenticate them with our app secret key.\n\nReturns a promise that will contain the auth token, or an error.\n\n    GithubAuth = ->\n\nIf the url contains a querystring parameter `code` then we send it to our auth\nserver to get the OAuth token.\n\n      if code = window.location.href.match(/\\?code=(.*)/)?[1]\n        $.getJSON(\"https://hamljr-auth.herokuapp.com/authenticate/#{code}\")\n        .then (data) ->\n          if token = data.token\n            localStorage.authToken = token\n          else\n            if localStorage.authToken\n              Deferred().resolve(localStorage.authToken)\n            else\n              Deferred().reject(\"Failed to get authorization from server and no token in local storage\")\n      else\n\nWe also check localStorage for our auth token.\n\n        if localStorage.authToken\n          Deferred().resolve(localStorage.authToken)\n        else\n          Deferred().reject(\"No token in local storage\")\n\n    module.exports = GithubAuth\n",
      "type": "blob"
    },
    "source/text_editor.coffee.md": {
      "path": "source/text_editor.coffee.md",
      "mode": "100644",
      "content": "The `TextEditor` is a model for editing a text file. Currently it uses the Ace\neditor, but we may switch in the future. All the editor specific things live in\nhere.\n\n    TextEditor = (I) ->\n      Object.reverseMerge I,\n        mode: \"coffee\"\n        text: \"\"\n\n      self = Model(I)\n\nWe can't use ace on a div not in the DOM so we need to be sure to pass one in.\n\n      el = I.el\n\nWe can't serialize DOM elements so we need to be sure to delete it.\n\n      delete I.el\n\nHere we create and configure the Ace text editor.\n\nTODO: Load these options from a preferences somewhere.\n\n      editor = ace.edit(el)\n      editor.setFontSize(\"16px\")\n      editor.setTheme(\"ace/theme/chrome\")\n      editor.getSession().setUseWorker(false)\n      editor.getSession().setMode(\"ace/mode/#{I.mode}\")\n      editor.getSession().setUseSoftTabs(true)\n      editor.getSession().setTabSize(2)\n\n`reset` Sets the content of the editor to the given content and also resets any\ncursor position or selection.\n\n      reset = (content=\"\") ->\n        editor.setValue(content)\n        editor.moveCursorTo(0, 0)\n        editor.session.selection.clearSelection()\n\n      reset(I.text)\n\nOur text attribute is observable so clients can track changes.\n\n      self.attrObservable \"text\"\n\nWe modify our text by listening to change events from Ace.\n\nTODO: Remove these `updating` hacks.\n\n      updating = false\n      editor.getSession().on 'change', ->\n        updating = true\n        self.text(editor.getValue())\n        updating = false\n\nWe also observe any changes to `text` ourselves to stay up to date with outside\nmodifications. Its a bi-directional binding.\n\n      self.text.observe (newValue) ->\n        unless updating\n          reset(newValue)\n\nWe expose some properties and methods.\n\n      self.extend\n        el: el\n        editor: editor\n        reset: reset\n\n      return self\n\n    module.exports = TextEditor\n",
      "type": "blob"
    },
    "source/util.coffee.md": {
      "path": "source/util.coffee.md",
      "mode": "100644",
      "content": "Util\n====\n\n    CSON = require \"cson\"\n\nA collection of shared utilities\n\n    Util =\n\nRead the config for the package from the package source.\n\n      readSourceConfig: (pkg=PACKAGE) ->\n        if configData = pkg.source[\"pixie.cson\"]?.content\n          CSON.parse(configData)\n        else if configData = pkg.source[\"pixie.json\"]?.content\n          JSON.parse(configData)\n        else\n          {}\n\nDecodes all content in place.\n\n      processDirectory: (items) ->\n        items.forEach (item) ->\n          return item unless item.content\n\n          if isBinary(item.path)\n            item.binary = true\n            item.content = atob(item.content.replace(/\\s/g, \"\"))\n          else # Text\n            # NOTE: This implementation of Base64 assumes utf-8\n            item.content = Base64.decode(item.content)\n\n          item.encoding = \"raw\"\n\n        return items\n\n`arrayToHash` converts an array of fileData objects into an object where each\nfile's path is a key and the fileData is the object.\n\n      arrayToHash: (array) ->\n        array.eachWithObject {}, (file, hash) ->\n          hash[file.path] = file\n\n    module.exports = Util\n\nHelpers\n-------\n\nDetermines if a file is a binary file by looking up common file extensions.\n\n    isBinary = (path) ->\n      pathCheckRegEx = RegExp [\n        \"gif\"\n        \"jpeg\"\n        \"jpg\"\n        \"mp3\"\n        \"png\"\n        \"sfs\"\n        \"wav\"\n      ].map (extension) ->\n        \"\\\\.#{extension}$\"\n      .join(\"|\")\n\n      path.match(pathCheckRegEx)\n",
      "type": "blob"
    },
    "style.styl": {
      "path": "style.styl",
      "mode": "100644",
      "content": "html, body\n  margin: 0\n  height: 100%\n\nbody\n  font-family: \"HelveticaNeue-Light\", \"Helvetica Neue Light\", \"Helvetica Neue\", Helvetica, Arial, \"Lucida Grande\", sans-serif\n  font-weight: 300\n\n.main\n  position: relative\n  padding-top: 40px\n  padding-left: 200px\n  padding-bottom: 100px\n  box-sizing: border-box\n  height: 100%\n\n.editor-wrap\n  background-color: white\n  width: 100%\n  height: 100%\n  position: relative\n\n  & > div\n    position: absolute\n    top: 0\n    left: 0\n    right: 0\n    bottom: 0\n\n.filetree\n  margin: 0\n  padding: 0\n  width: 200px\n  overflow-x: hidden\n  overflow-y: auto\n  position: absolute\n  left: 0\n  bottom: 0\n  top: 40px\n  z-index: 2\n\n  li\n    cursor: pointer\n    list-style-type: none\n    padding-left: 1em\n    position: relative\n    whitespace: nowrap\n\n    .delete\n      display: none\n      position: absolute\n      right: 0\n      top: 0\n\n    &:hover\n      background-color: lightyellow\n\n      .delete\n        display: inline-block\n\n.actions\n  position: absolute\n  top: 0\n  left: 200px\n  z-index: 1\n\n.repo_info\n  box-sizing: border-box\n  position: absolute\n  top: 0\n  left: 0\n  padding: 0.25em 1em\n  width: 200px\n  overflow: hidden\n  border-bottom: 1px solid black\n  height: 40px\n  font-size: 0.8em\n\n.console-wrap\n  box-sizing: border-box\n  position: absolute\n  bottom: 0\n  left: 0\n  right: 0\n  padding-left: 200px\n  height: 100px\n  width: 100%\n  margin: 0\n\n  .errors\n    box-sizing: border-box\n    border-top: 1px solid black\n    color: red\n\n.status\n  top: 0\n  right: 0\n  position: absolute\n",
      "type": "blob"
    },
    "templates/actions.haml.md": {
      "path": "templates/actions.haml.md",
      "mode": "100644",
      "content": "The actions bar holds several buttons that can be pressed to perform actions in\nthe editor.\n\n    .actions\n      - actions = @actions\n\nRender a series of buttons, one for each action.\n\n      - Object.keys(actions).each (name) ->\n        %button\n          = name.titleize()\n\nIn our click handler we don't pass any event data to the action.\n\n          - on \"click\", ->\n            - actions[name]()\n\nThe issues selector is also rendered in the actions bar.\n\n      = HAMLjr.render \"issues\", @issues\n",
      "type": "blob"
    },
    "templates/editor.haml.md": {
      "path": "templates/editor.haml.md",
      "mode": "100644",
      "content": "The main editor template renders all the other sub-templates.\n\n    .main\n      = HAMLjr.render \"actions\", actions: @actions, issues: @issues\n      = HAMLjr.render \"filetree\", @filetree\n      = HAMLjr.render \"notifications\", @notifications\n      = HAMLjr.render \"repo_info\", @repository\n      = HAMLjr.render \"github_status\", @github\n",
      "type": "blob"
    },
    "templates/github_status.haml.md": {
      "path": "templates/github_status.haml.md",
      "mode": "100644",
      "content": "Github Status\n=============\n\nDisplay information about the current Github api session.\n\n    .status\n      - github = this\n      - with @lastRequest, ->\n        %div\n          - if @getAllResponseHeaders and @getAllResponseHeaders().match(/X-RateLimit-Limit: 5000/)\n            Authenticated Scopes:\n            = @getResponseHeader(\"X-OAuth-Scopes\")\n            %br\n            Rate Limit Remaining:\n            = @getResponseHeader(\"X-RateLimit-Remaining\")\n            = \" / 5000\"\n          - else\n            %button Auth\n              - on \"click\", ->\n                - window.location = github.authorizationUrl(\"bc46af967c926ba4ff87\", \"gist,repo,user:email\")\n",
      "type": "blob"
    },
    "templates/repo_info.haml.md": {
      "path": "templates/repo_info.haml.md",
      "mode": "100644",
      "content": "Display some info about the current repository\n\n    .repo_info\n      - with this, ->\n        %div\n          = @full_name\n          :\n          = @branch\n",
      "type": "blob"
    },
    "templates/text_editor.haml.md": {
      "path": "templates/text_editor.haml.md",
      "mode": "100644",
      "content": "A simple wrap to hold a text editor.\n\n    .editor-wrap\n      .editor\n",
      "type": "blob"
    },
    "test/images.coffee": {
      "path": "test/images.coffee",
      "mode": "100644",
      "content": "Images = require \"../lib/images\"\n\ndescribe \"images\", ->\n  it \"should convert\", ->\n    testImage = atob \"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAALUlEQVRYR+3QQREAAAABQfqXFsNnFTizzXk99+MAAQIECBAgQIAAAQIECBAgMBo/ACHo7lH9AAAAAElFTkSuQmCC\"\n    result = Images.convert [{\n      path: \"images/test.png\"\n      content: testImage\n    }, {\n      path: \"images/yolo.png\"\n      content: testImage\n    }, {\n      path: \"main.coffee.md\"\n      content: \"Not an image\"\n    }]\n\n    assert result.test\n    assert result.yolo\n    assert !result.main\n",
      "type": "blob"
    },
    "test/test.coffee.md": {
      "path": "test/test.coffee.md",
      "mode": "100644",
      "content": "Starting with just an assert true to test that testing works at all.\n\n    describe \"editor\", ->\n      it \"should test things\", ->\n        assert true\n",
      "type": "blob"
    },
    "test/util.coffee.md": {
      "path": "test/util.coffee.md",
      "mode": "100644",
      "content": "    Util = require \"../source/util\"\n\n    describe \"Util\", ->\n      it \"should allow reading of the source config\", ->\n        assert Util.readSourceConfig(PACKAGE)\n",
      "type": "blob"
    }
  },
  "distribution": {
    "editor": {
      "path": "editor",
      "content": "(function() {\n  var Actions, Builder, File, Filetree, Packager, Runner, arrayToHash, initBuilder, readSourceConfig, _ref, _ref1;\n\n  Runner = require(\"runner\");\n\n  Actions = require(\"./source/actions\");\n\n  Builder = require(\"builder\");\n\n  Packager = require(\"packager\");\n\n  _ref = require(\"filetree\"), Filetree = _ref.Filetree, File = _ref.File;\n\n  initBuilder = function() {\n    var builder;\n    builder = Builder();\n    builder.addPostProcessor(function(pkg) {\n      return pkg.progenitor = {\n        url: \"http://strd6.github.io/editor/\"\n      };\n    });\n    builder.addPostProcessor(function(pkg) {\n      var config;\n      config = readSourceConfig(pkg);\n      pkg.version = config.version;\n      pkg.entryPoint = config.entryPoint || \"main\";\n      return pkg.remoteDependencies = config.remoteDependencies;\n    });\n    return builder;\n  };\n\n  module.exports = function(I, self) {\n    var builder, filetree, runner;\n    if (I == null) {\n      I = {};\n    }\n    if (self == null) {\n      self = Model(I);\n    }\n    runner = Runner();\n    builder = initBuilder();\n    filetree = Filetree();\n    self.extend({\n      repository: Observable(),\n      build: function() {\n        var data;\n        data = filetree.data();\n        return builder.build(data).then(function(pkg) {\n          var config, dependencies;\n          config = readSourceConfig(pkg);\n          dependencies = config.dependencies || {};\n          return Packager.collectDependencies(dependencies, PACKAGE.dependencies).then(function(dependencies) {\n            pkg.dependencies = dependencies;\n            return pkg;\n          });\n        });\n      },\n      save: function() {\n        return self.repository().commitTree({\n          tree: filetree.data()\n        });\n      },\n      loadFiles: function(fileData) {\n        return filetree.load(fileData);\n      },\n      filetree: function() {\n        return filetree;\n      },\n      files: function() {\n        return filetree.files();\n      },\n      fileAt: function(path) {\n        return self.files().select(function(file) {\n          return file.path() === path;\n        }).first();\n      },\n      fileContents: function(path) {\n        var _ref1;\n        return (_ref1 = self.fileAt(path)) != null ? _ref1.content() : void 0;\n      },\n      filesMatching: function(expr) {\n        return self.files().select(function(file) {\n          return file.path().match(expr);\n        });\n      },\n      writeFile: function(path, content) {\n        var existingFile, file;\n        if (existingFile = self.fileAt(path)) {\n          existingFile.content(content);\n          return existingFile;\n        } else {\n          file = File({\n            path: path,\n            content: content\n          });\n          filetree.files.push(file);\n          return file;\n        }\n      },\n      builder: function() {\n        return builder;\n      },\n      config: function() {\n        return readSourceConfig({\n          source: arrayToHash(filetree.data())\n        });\n      },\n      runner: function() {\n        return runner;\n      },\n      runInSandboxWindow: function(config, promise) {\n        var sandbox;\n        sandbox = runner.run({\n          config: config\n        });\n        return promise.then(function(content) {\n          sandbox.document.open();\n          sandbox.document.write(content);\n          return sandbox.document.close();\n        }, function(error) {\n          sandbox.close();\n          return error;\n        });\n      }\n    });\n    self.include(Actions);\n    builder.addPostProcessor(function(pkg) {\n      var repository;\n      repository = self.repository();\n      pkg.repository = repository.toJSON();\n      pkg.repository.publishBranch = self.config().publishBranch || repository.publishBranch();\n      return pkg;\n    });\n    return self;\n  };\n\n  _ref1 = require(\"./source/util\"), readSourceConfig = _ref1.readSourceConfig, arrayToHash = _ref1.arrayToHash;\n\n}).call(this);\n\n//# sourceURL=editor.coffee",
      "type": "blob"
    },
    "lib/converter": {
      "path": "lib/converter",
      "content": "(function() {\n  var self;\n\n  module.exports = self = {\n    convertDataToJSON: function(_arg) {\n      var editor, existingData, fileData, imageFiles, matcher, mimeType, outputFileName, _ref;\n      _ref = _arg != null ? _arg : {}, editor = _ref.editor, outputFileName = _ref.outputFileName, matcher = _ref.matcher, mimeType = _ref.mimeType;\n      if (outputFileName == null) {\n        outputFileName = \"sounds.json\";\n      }\n      if (matcher == null) {\n        matcher = /^sounds\\/(.*)\\.wav$/;\n      }\n      if (mimeType == null) {\n        mimeType = \"audio/wav\";\n      }\n      imageFiles = editor.filesMatching(matcher);\n      fileData = self.convert(imageFiles.map(function(file) {\n        return {\n          path: file.path(),\n          content: file.content(),\n          mimeType: mimeType,\n          replacer: matcher\n        };\n      }));\n      imageFiles.forEach(function(file) {\n        return editor.files().remove(file);\n      });\n      try {\n        existingData = JSON.parse(editor.fileContents(outputFileName));\n      } catch (_error) {\n        existingData = {};\n      }\n      Object.extend(existingData, fileData);\n      return editor.writeFile(outputFileName, JSON.stringify(existingData, null, 2));\n    },\n    convert: function(fileData) {\n      return fileData.reduce(function(hash, _arg) {\n        var content, mimeType, path, replacer;\n        path = _arg.path, content = _arg.content, mimeType = _arg.mimeType, replacer = _arg.replacer;\n        path = path.replace(replacer, \"$1\");\n        hash[path] = \"data:\" + mimeType + \";base64,\" + (btoa(content));\n        return hash;\n      }, {});\n    }\n  };\n\n}).call(this);\n\n//# sourceURL=lib/converter.coffee",
      "type": "blob"
    },
    "main": {
      "path": "main",
      "content": "(function() {\n  var $root, Editor, File, Hygiene, Issue, Issues, Packager, Runtime, TextEditor, actions, builder, classicError, closeOpenEditors, confirmUnsaved, editor, errors, files, filetree, filetreeTemplate, hotReloadCSS, issues, issuesTemplate, notifications, notify, processDirectory, readSourceConfig, repository, templates, _base, _ref, _ref1, _ref2, _ref3,\n    __slice = [].slice;\n\n  files = PACKAGE.source;\n\n  global.Sandbox = require('sandbox');\n\n  require(\"./source/duct_tape\");\n\n  require(\"./source/deferred\");\n\n  processDirectory = require(\"./source/util\").processDirectory;\n\n  global.PACKAGE = PACKAGE;\n\n  global.require = require;\n\n  global.github = require(\"github\")(require(\"./source/github_auth\")());\n\n  templates = (HAMLjr.templates || (HAMLjr.templates = {}));\n\n  [\"actions\", \"editor\", \"github_status\", \"text_editor\", \"repo_info\"].each(function(name) {\n    var template;\n    template = require(\"./templates/\" + name);\n    if (typeof template === \"function\") {\n      return templates[name] = template;\n    }\n  });\n\n  Editor = require(\"./editor\");\n\n  TextEditor = require(\"./source/text_editor\");\n\n  editor = global.editor = Editor();\n\n  editor.loadFiles(files);\n\n  builder = editor.builder();\n\n  filetree = editor.filetree();\n\n  _ref = require(\"filetree\"), File = _ref.File, filetreeTemplate = _ref.template;\n\n  templates[\"filetree\"] = filetreeTemplate;\n\n  Hygiene = require(\"hygiene\");\n\n  Runtime = require(\"runtime\");\n\n  Packager = require(\"packager\");\n\n  readSourceConfig = require(\"./source/util\").readSourceConfig;\n\n  notifications = require(\"notifications\")();\n\n  templates.notifications = notifications.template;\n\n  classicError = notifications.classicError, notify = notifications.notify, errors = notifications.errors;\n\n  Runtime(PACKAGE).boot().applyStyleSheet(require('./style'));\n\n  $root = $(\"body\");\n\n  _ref1 = require(\"issues\"), (_ref2 = _ref1.models, Issue = _ref2.Issue, Issues = _ref2.Issues), (_ref3 = _ref1.templates, issuesTemplate = _ref3.issues);\n\n  templates[\"issues\"] = issuesTemplate;\n\n  issues = Issues();\n\n  repository = editor.repository;\n\n  repository.observe(function(repository) {\n    issues.repository = repository;\n    repository.pullRequests().then(issues.reset);\n    return notify(\"Loaded repository: \" + (repository.full_name()));\n  });\n\n  (_base = PACKAGE.repository).url || (_base.url = \"repos/\" + PACKAGE.repository.full_name);\n\n  repository(github.Repository(PACKAGE.repository));\n\n  confirmUnsaved = function() {\n    return Deferred.ConfirmIf(filetree.hasUnsavedChanges(), \"You will lose unsaved changes in your current branch, continue?\");\n  };\n\n  closeOpenEditors = function() {\n    var root;\n    root = $root.children(\".main\");\n    return root.find(\".editor-wrap\").remove();\n  };\n\n  actions = {\n    save: function() {\n      notify(\"Saving...\");\n      return editor.save().then(function() {\n        filetree.markSaved();\n        return editor.publish();\n      }).then(function() {\n        return notify(\"Saved and published!\");\n      }).fail(function() {\n        var args;\n        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];\n        return errors(args);\n      });\n    },\n    run: function() {\n      notify(\"Running...\");\n      return editor.run().fail(classicError);\n    },\n    test: function() {\n      notify(\"Running tests...\");\n      return editor.test().fail(errors);\n    },\n    docs: function() {\n      var file;\n      notify(\"Running Docs...\");\n      if (file = prompt(\"Docs file\", \"index\")) {\n        return editor.runDocs({\n          file: file\n        }).fail(errors);\n      }\n    },\n    convert_data: function() {\n      var converter;\n      converter = require(\"./lib/converter\").convertDataToJSON;\n      converter({\n        editor: editor,\n        outputFileName: \"images.json\",\n        matcher: /^images\\/(.*)\\.png$/,\n        mimeType: \"image/png\"\n      });\n      converter({\n        editor: editor,\n        outputFileName: \"sounds.json\",\n        matcher: /^sounds\\/(.*)\\.wav$/,\n        mimeType: \"audio/wav\"\n      });\n      return converter({\n        editor: editor,\n        outputFileName: \"music.json\",\n        matcher: /^sounds\\/(.*)\\.mp3$/,\n        mimeType: \"audio/mp3\"\n      });\n    },\n    new_file: function() {\n      var file, name;\n      if (name = prompt(\"File Name\", \"newfile.coffee\")) {\n        file = File({\n          path: name,\n          content: \"\"\n        });\n        filetree.files.push(file);\n        return filetree.selectedFile(file);\n      }\n    },\n    load_repo: function(skipPrompt) {\n      return confirmUnsaved().then(function() {\n        var currentRepositoryName, fullName;\n        currentRepositoryName = repository().full_name();\n        fullName = prompt(\"Github repo\", currentRepositoryName);\n        if (fullName) {\n          return github.repository(fullName).then(repository);\n        } else {\n          return Deferred().reject(\"No repo given\");\n        }\n      }).then(function(repositoryInstance) {\n        notify(\"Loading files...\");\n        return editor.load({\n          repository: repositoryInstance\n        }).then(function() {\n          closeOpenEditors();\n          return notifications.push(\"Loaded\");\n        });\n      }).fail(classicError);\n    },\n    new_feature: function() {\n      var title;\n      if (title = prompt(\"Description\")) {\n        notify(\"Creating feature branch...\");\n        return editor.repository().createPullRequest({\n          title: title\n        }).then(function(data) {\n          var issue;\n          issue = Issue(data);\n          issues.issues.push(issue);\n          issues.silent = true;\n          issues.currentIssue(issue);\n          issues.silent = false;\n          return notifications.push(\"Created!\");\n        }, classicError);\n      }\n    },\n    pull_master: function() {\n      return confirmUnsaved().then(function() {\n        notify(\"Merging in default branch...\");\n        return repository().pullFromBranch();\n      }, classicError).then(function() {\n        var branchName;\n        notifications.push(\"Merged!\");\n        branchName = repository().branch();\n        notifications.push(\"\\nReloading branch \" + branchName + \"...\");\n        return editor.load({\n          repository: repository()\n        }).then(function() {\n          return notifications.push(\"Loaded!\");\n        }).fail(function() {\n          return classicError(\"Error loading \" + (repository().url()));\n        });\n      });\n    },\n    pull_upstream: function() {\n      return confirmUnsaved().then(function() {\n        var upstreamRepo;\n        notify(\"Pulling from upstream master\");\n        upstreamRepo = repository().parent().full_name;\n        return github.repository(upstreamRepo).then(function(repository) {\n          return repository.latestContent();\n        }).then(function(results) {\n          files = processDirectory(results);\n          return editor.loadFiles(files);\n        });\n      }, classicError).then(function() {\n        notifications.push(\"\\nYour code is up to date with the upstream master\");\n        return closeOpenEditors();\n      });\n    },\n    tag_version: function() {\n      notify(\"Building...\");\n      return editor.build().then(function(pkg) {\n        var version;\n        version = \"v\" + (readSourceConfig(pkg).version);\n        notify(\"Tagging version \" + version + \" ...\");\n        return repository().createRef(\"refs/tags/\" + version).then(function() {\n          return notifications.push(\"Tagged \" + version);\n        }).then(function() {\n          notifications.push(\"\\nPublishing...\");\n          pkg.repository.branch = version;\n          return repository().publish(Packager.standAlone(pkg), version);\n        }).then(function() {\n          return notifications.push(\"Published!\");\n        });\n      }).fail(classicError);\n    }\n  };\n\n  filetree.selectedFile.observe(function(file) {\n    var root, textEditor;\n    if (typeof file.binary === \"function\" ? file.binary() : void 0) {\n      return;\n    }\n    root = $root.children(\".main\");\n    root.find(\".editor-wrap\").hide();\n    if (file.editor) {\n      return file.editor.trigger(\"show\");\n    } else {\n      root.append(HAMLjr.render(\"text_editor\"));\n      file.editor = root.find(\".editor-wrap\").last();\n      switch (file.path().extension()) {\n        case \"md\":\n        case \"coffee\":\n        case \"js\":\n        case \"styl\":\n        case \"cson\":\n          file.content(Hygiene.clean(file.content()));\n      }\n      textEditor = TextEditor({\n        text: file.content(),\n        el: file.editor.find('.editor').get(0),\n        mode: file.mode()\n      });\n      file.editor.on(\"show\", function() {\n        file.editor.show();\n        return textEditor.editor.focus();\n      });\n      return textEditor.text.observe(function(value) {\n        file.content(value);\n        if (file.path().match(/\\.styl$/)) {\n          return hotReloadCSS(file);\n        }\n      });\n    }\n  });\n\n  hotReloadCSS = (function(file) {\n    var css;\n    try {\n      css = styl(file.content(), {\n        whitespace: true\n      }).toString();\n    } catch (_error) {}\n    if (css) {\n      return editor.runner().hotReloadCSS(css);\n    }\n  }).debounce(100);\n\n  if (issues != null) {\n    issues.currentIssue.observe(function(issue) {\n      var changeBranch;\n      if (issues.silent) {\n        return;\n      }\n      changeBranch = function(branchName) {\n        var previousBranch;\n        previousBranch = repository().branch();\n        return confirmUnsaved().then(function() {\n          closeOpenEditors();\n          return repository().switchToBranch(branchName).then(function() {\n            notifications.push(\"\\nLoading branch \" + branchName + \"...\");\n            return editor.load({\n              repository: repository()\n            }).then(function() {\n              return notifications.push(\"Loaded!\");\n            });\n          });\n        }, function() {\n          repository.branch(previousBranch);\n          return classicError(\"Error switching to \" + branchName + \", still on \" + previousBranch);\n        });\n      };\n      if (issue) {\n        notify(issue.fullDescription());\n        return changeBranch(issue.branchName());\n      } else {\n        notify(\"Default branch selected\");\n        return changeBranch(repository().defaultBranch());\n      }\n    });\n  }\n\n  $root.append(HAMLjr.render(\"editor\", {\n    filetree: filetree,\n    actions: actions,\n    notifications: notifications,\n    issues: issues,\n    github: github,\n    repository: repository\n  }));\n\n  window.onbeforeunload = function() {\n    if (filetree.hasUnsavedChanges()) {\n      return \"You have some unsaved changes, if you leave now you will lose your work.\";\n    }\n  };\n\n}).call(this);\n\n//# sourceURL=main.coffee",
      "type": "blob"
    },
    "pixie": {
      "path": "pixie",
      "content": "module.exports = {\"version\":\"0.3.0\",\"entryPoint\":\"main\",\"width\":960,\"height\":800,\"remoteDependencies\":[\"https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.5.2/underscore-min.js\",\"https://cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js\",\"https://code.jquery.com/jquery-1.10.1.min.js\",\"https://d1n0x3qji82z53.cloudfront.net/src-min-noconflict/ace.js\",\"http://www.danielx.net/tempest/javascripts/envweb-v0.4.5.js\"],\"dependencies\":{\"builder\":\"distri/builder:v0.3.2\",\"cson\":\"distri/cson:v0.1.0\",\"issues\":\"STRd6/issues:v0.2.0\",\"sandbox\":\"STRd6/sandbox:v0.2.0\",\"notifications\":\"STRd6/notifications:v0.2.0\",\"md\":\"STRd6/md:v0.3.2\",\"github\":\"STRd6/github:v0.4.2\",\"hygiene\":\"STRd6/hygiene:v0.2.0\",\"runtime\":\"distri/runtime:v0.3.0\",\"packager\":\"distri/packager:v0.5.2\",\"filetree\":\"STRd6/filetree:v0.3.0\",\"runner\":\"STRd6/runner:v0.2.0\"}};",
      "type": "blob"
    },
    "source/actions": {
      "path": "source/actions",
      "content": "(function() {\n  var Actions, Packager, docsConfig, documenter, findFile, index, processDirectory;\n\n  Packager = require(\"packager\");\n\n  processDirectory = require(\"./util\").processDirectory;\n\n  documenter = require(\"md\");\n\n  Actions = function(I, self) {\n    if (I == null) {\n      I = {};\n    }\n    return self.extend({\n      run: function() {\n        return self.runInSandboxWindow(self.config(), self.build().then(function(pkg) {\n          return Packager.standAlone(pkg);\n        }).then(function(files) {\n          var content, _ref;\n          return content = (_ref = index(files)) != null ? _ref.content : void 0;\n        }));\n      },\n      runDocs: function(_arg) {\n        var file;\n        file = _arg.file;\n        if (file == null) {\n          file = \"index\";\n        }\n        return self.runInSandboxWindow(docsConfig, self.build().then(function(pkg) {\n          return documenter.documentAll(pkg);\n        }).then(function(docs) {\n          var path, script;\n          script = docs.first();\n          path = script.path.split(\"/\");\n          path.pop();\n          path.push(\"\" + file + \".html\");\n          path = path.join(\"/\");\n          if (file = findFile(path, docs)) {\n            return file.content + (\"<script>\" + script.content + \"<\\/script>\");\n          } else {\n            return \"Failed to find file at \" + path;\n          }\n        }));\n      },\n      publish: function() {\n        return self.build().then(function(pkg) {\n          return documenter.documentAll(pkg).then(function(docs) {\n            var publishBranch, repository;\n            publishBranch = pkg.repository.publishBranch;\n            repository = self.repository();\n            if (repository.branch() === \"blog\") {\n              return self.repository().publish(docs, void 0, publishBranch);\n            } else {\n              return self.repository().publish(Packager.standAlone(pkg, docs), void 0, publishBranch);\n            }\n          });\n        });\n      },\n      test: function() {\n        return self.runInSandboxWindow(self.config(), self.build().then(function(pkg) {\n          return Packager.testScripts(pkg);\n        }).then(function(testScripts) {\n          var html;\n          return html = self.runner().testsHtml(testScripts);\n        }));\n      },\n      load: function(_arg) {\n        var repository;\n        repository = _arg.repository;\n        return repository.latestContent().then(function(results) {\n          var files;\n          self.repository(repository);\n          files = processDirectory(results);\n          return self.loadFiles(files);\n        });\n      }\n    });\n  };\n\n  module.exports = Actions;\n\n  docsConfig = {\n    width: 1280,\n    height: 800\n  };\n\n  index = function(files) {\n    return files.filter(function(file) {\n      return /index\\.html$/.test(file.path);\n    }).first();\n  };\n\n  findFile = function(path, files) {\n    return files.filter(function(file) {\n      return file.path === path;\n    }).first();\n  };\n\n}).call(this);\n\n//# sourceURL=source/actions.coffee",
      "type": "blob"
    },
    "source/deferred": {
      "path": "source/deferred",
      "content": "(function() {\n  var withDeferrence,\n    __slice = [].slice;\n\n  global.Deferred = $.Deferred;\n\n  withDeferrence = function(fn) {\n    var deferred, e;\n    deferred = Deferred();\n    try {\n      fn.defer(deferred);\n    } catch (_error) {\n      e = _error;\n      deferred.reject(e);\n    }\n    return deferred.promise();\n  };\n\n  Deferred.Confirm = function(message) {\n    return withDeferrence(function(deferred) {\n      if (window.confirm(message)) {\n        return deferred.resolve();\n      } else {\n        return deferred.reject();\n      }\n    });\n  };\n\n  Deferred.ConfirmIf = function(flag, message) {\n    if (flag) {\n      return Deferred.Confirm(message);\n    } else {\n      return withDeferrence(function(deferred) {\n        return deferred.resolve();\n      });\n    }\n  };\n\n  Deferred.ExecuteIf = function(flag, callback) {\n    return withDeferrence(function(deferred) {\n      if (flag) {\n        return callback().then(deferred.resolve);\n      } else {\n        return deferred.resolve();\n      }\n    });\n  };\n\n  Deferred.when = function(promises) {\n    return $.when.apply(null, promises).then(function() {\n      var results;\n      results = 1 <= arguments.length ? __slice.call(arguments, 0) : [];\n      if (promises.length === 1) {\n        return results = [results];\n      } else {\n        return results;\n      }\n    });\n  };\n\n}).call(this);\n\n//# sourceURL=source/deferred.coffee",
      "type": "blob"
    },
    "source/duct_tape": {
      "path": "source/duct_tape",
      "content": "(function() {\n  String.prototype.dasherize = function() {\n    return this.trim().replace(/\\s+/g, \"-\").toLowerCase();\n  };\n\n  HAMLjr.render = function(templateName, object) {\n    var template, templates;\n    templates = HAMLjr.templates;\n    template = templates[templateName] || templates[\"templates/\" + templateName];\n    if (template) {\n      return template(object);\n    } else {\n      throw \"Could not find template named \" + templateName;\n    }\n  };\n\n}).call(this);\n\n//# sourceURL=source/duct_tape.coffee",
      "type": "blob"
    },
    "source/github_auth": {
      "path": "source/github_auth",
      "content": "(function() {\n  var GithubAuth;\n\n  GithubAuth = function() {\n    var code, _ref;\n    if (code = (_ref = window.location.href.match(/\\?code=(.*)/)) != null ? _ref[1] : void 0) {\n      return $.getJSON(\"https://hamljr-auth.herokuapp.com/authenticate/\" + code).then(function(data) {\n        var token;\n        if (token = data.token) {\n          return localStorage.authToken = token;\n        } else {\n          if (localStorage.authToken) {\n            return Deferred().resolve(localStorage.authToken);\n          } else {\n            return Deferred().reject(\"Failed to get authorization from server and no token in local storage\");\n          }\n        }\n      });\n    } else {\n      if (localStorage.authToken) {\n        return Deferred().resolve(localStorage.authToken);\n      } else {\n        return Deferred().reject(\"No token in local storage\");\n      }\n    }\n  };\n\n  module.exports = GithubAuth;\n\n}).call(this);\n\n//# sourceURL=source/github_auth.coffee",
      "type": "blob"
    },
    "source/text_editor": {
      "path": "source/text_editor",
      "content": "(function() {\n  var TextEditor;\n\n  TextEditor = function(I) {\n    var editor, el, reset, self, updating;\n    Object.reverseMerge(I, {\n      mode: \"coffee\",\n      text: \"\"\n    });\n    self = Model(I);\n    el = I.el;\n    delete I.el;\n    editor = ace.edit(el);\n    editor.setFontSize(\"16px\");\n    editor.setTheme(\"ace/theme/chrome\");\n    editor.getSession().setUseWorker(false);\n    editor.getSession().setMode(\"ace/mode/\" + I.mode);\n    editor.getSession().setUseSoftTabs(true);\n    editor.getSession().setTabSize(2);\n    reset = function(content) {\n      if (content == null) {\n        content = \"\";\n      }\n      editor.setValue(content);\n      editor.moveCursorTo(0, 0);\n      return editor.session.selection.clearSelection();\n    };\n    reset(I.text);\n    self.attrObservable(\"text\");\n    updating = false;\n    editor.getSession().on('change', function() {\n      updating = true;\n      self.text(editor.getValue());\n      return updating = false;\n    });\n    self.text.observe(function(newValue) {\n      if (!updating) {\n        return reset(newValue);\n      }\n    });\n    self.extend({\n      el: el,\n      editor: editor,\n      reset: reset\n    });\n    return self;\n  };\n\n  module.exports = TextEditor;\n\n}).call(this);\n\n//# sourceURL=source/text_editor.coffee",
      "type": "blob"
    },
    "source/util": {
      "path": "source/util",
      "content": "(function() {\n  var CSON, Util, isBinary;\n\n  CSON = require(\"cson\");\n\n  Util = {\n    readSourceConfig: function(pkg) {\n      var configData, _ref, _ref1;\n      if (pkg == null) {\n        pkg = PACKAGE;\n      }\n      if (configData = (_ref = pkg.source[\"pixie.cson\"]) != null ? _ref.content : void 0) {\n        return CSON.parse(configData);\n      } else if (configData = (_ref1 = pkg.source[\"pixie.json\"]) != null ? _ref1.content : void 0) {\n        return JSON.parse(configData);\n      } else {\n        return {};\n      }\n    },\n    processDirectory: function(items) {\n      items.forEach(function(item) {\n        if (!item.content) {\n          return item;\n        }\n        if (isBinary(item.path)) {\n          item.binary = true;\n          item.content = atob(item.content.replace(/\\s/g, \"\"));\n        } else {\n          item.content = Base64.decode(item.content);\n        }\n        return item.encoding = \"raw\";\n      });\n      return items;\n    },\n    arrayToHash: function(array) {\n      return array.eachWithObject({}, function(file, hash) {\n        return hash[file.path] = file;\n      });\n    }\n  };\n\n  module.exports = Util;\n\n  isBinary = function(path) {\n    var pathCheckRegEx;\n    pathCheckRegEx = RegExp([\"gif\", \"jpeg\", \"jpg\", \"mp3\", \"png\", \"sfs\", \"wav\"].map(function(extension) {\n      return \"\\\\.\" + extension + \"$\";\n    }).join(\"|\"));\n    return path.match(pathCheckRegEx);\n  };\n\n}).call(this);\n\n//# sourceURL=source/util.coffee",
      "type": "blob"
    },
    "style": {
      "path": "style",
      "content": "module.exports = \"html,\\nbody {\\n  margin: 0;\\n  height: 100%;\\n}\\n\\nbody {\\n  font-family: \\\"HelveticaNeue-Light\\\", \\\"Helvetica Neue Light\\\", \\\"Helvetica Neue\\\", Helvetica, Arial, \\\"Lucida Grande\\\", sans-serif;\\n  font-weight: 300;\\n}\\n\\n.main {\\n  position: relative;\\n  padding-top: 40px;\\n  padding-left: 200px;\\n  padding-bottom: 100px;\\n  height: 100%;\\n  -ms-box-sizing: border-box;\\n  -moz-box-sizing: border-box;\\n  -webkit-box-sizing: border-box;\\n  box-sizing: border-box;\\n}\\n\\n.editor-wrap {\\n  background-color: white;\\n  width: 100%;\\n  height: 100%;\\n  position: relative;\\n}\\n\\n.editor-wrap > div {\\n  position: absolute;\\n  top: 0;\\n  left: 0;\\n  right: 0;\\n  bottom: 0;\\n}\\n\\n.filetree {\\n  margin: 0;\\n  padding: 0;\\n  width: 200px;\\n  overflow-x: hidden;\\n  overflow-y: auto;\\n  position: absolute;\\n  left: 0;\\n  bottom: 0;\\n  top: 40px;\\n  z-index: 2;\\n}\\n\\n.filetree li .delete {\\n  display: none;\\n  position: absolute;\\n  right: 0;\\n  top: 0;\\n}\\n\\n.filetree li:hover .delete {\\n  display: inline-block;\\n}\\n\\n.filetree li:hover {\\n  background-color: lightyellow;\\n}\\n\\n.filetree li {\\n  cursor: pointer;\\n  list-style-type: none;\\n  padding-left: 1em;\\n  position: relative;\\n  whitespace: nowrap;\\n}\\n\\n.actions {\\n  position: absolute;\\n  top: 0;\\n  left: 200px;\\n  z-index: 1;\\n}\\n\\n.repo_info {\\n  position: absolute;\\n  top: 0;\\n  left: 0;\\n  padding: 0.25em 1em;\\n  width: 200px;\\n  overflow: hidden;\\n  border-bottom: 1px solid black;\\n  height: 40px;\\n  font-size: 0.8em;\\n  -ms-box-sizing: border-box;\\n  -moz-box-sizing: border-box;\\n  -webkit-box-sizing: border-box;\\n  box-sizing: border-box;\\n}\\n\\n.console-wrap {\\n  position: absolute;\\n  bottom: 0;\\n  left: 0;\\n  right: 0;\\n  padding-left: 200px;\\n  height: 100px;\\n  width: 100%;\\n  margin: 0;\\n  -ms-box-sizing: border-box;\\n  -moz-box-sizing: border-box;\\n  -webkit-box-sizing: border-box;\\n  box-sizing: border-box;\\n}\\n\\n.console-wrap .errors {\\n  border-top: 1px solid black;\\n  color: red;\\n  -ms-box-sizing: border-box;\\n  -moz-box-sizing: border-box;\\n  -webkit-box-sizing: border-box;\\n  box-sizing: border-box;\\n}\\n\\n.status {\\n  top: 0;\\n  right: 0;\\n  position: absolute;\\n}\";",
      "type": "blob"
    },
    "templates/actions": {
      "path": "templates/actions",
      "content": "module.exports = Function(\"return \" + HAMLjr.compile(\"\\n\\n\\n.actions\\n  - actions = @actions\\n\\n\\n\\n  - Object.keys(actions).each (name) ->\\n    %button\\n      = name.titleize()\\n\\n\\n\\n      - on \\\"click\\\", ->\\n        - actions[name]()\\n\\n\\n\\n  = HAMLjr.render \\\"issues\\\", @issues\\n\", {compiler: CoffeeScript}))()",
      "type": "blob"
    },
    "templates/editor": {
      "path": "templates/editor",
      "content": "module.exports = Function(\"return \" + HAMLjr.compile(\"\\n\\n.main\\n  = HAMLjr.render \\\"actions\\\", actions: @actions, issues: @issues\\n  = HAMLjr.render \\\"filetree\\\", @filetree\\n  = HAMLjr.render \\\"notifications\\\", @notifications\\n  = HAMLjr.render \\\"repo_info\\\", @repository\\n  = HAMLjr.render \\\"github_status\\\", @github\\n\", {compiler: CoffeeScript}))()",
      "type": "blob"
    },
    "templates/github_status": {
      "path": "templates/github_status",
      "content": "module.exports = Function(\"return \" + HAMLjr.compile(\"\\n\\n\\n\\n\\n.status\\n  - github = this\\n  - with @lastRequest, ->\\n    %div\\n      - if @getAllResponseHeaders and @getAllResponseHeaders().match(/X-RateLimit-Limit: 5000/)\\n        Authenticated Scopes:\\n        = @getResponseHeader(\\\"X-OAuth-Scopes\\\")\\n        %br\\n        Rate Limit Remaining:\\n        = @getResponseHeader(\\\"X-RateLimit-Remaining\\\")\\n        = \\\" / 5000\\\"\\n      - else\\n        %button Auth\\n          - on \\\"click\\\", ->\\n            - window.location = github.authorizationUrl(\\\"bc46af967c926ba4ff87\\\", \\\"gist,repo,user:email\\\")\\n\", {compiler: CoffeeScript}))()",
      "type": "blob"
    },
    "templates/repo_info": {
      "path": "templates/repo_info",
      "content": "module.exports = Function(\"return \" + HAMLjr.compile(\"\\n\\n.repo_info\\n  - with this, ->\\n    %div\\n      = @full_name\\n      :\\n      = @branch\\n\", {compiler: CoffeeScript}))()",
      "type": "blob"
    },
    "templates/text_editor": {
      "path": "templates/text_editor",
      "content": "module.exports = Function(\"return \" + HAMLjr.compile(\"\\n\\n.editor-wrap\\n  .editor\\n\", {compiler: CoffeeScript}))()",
      "type": "blob"
    },
    "test/images": {
      "path": "test/images",
      "content": "(function() {\n  var Images;\n\n  Images = require(\"../lib/images\");\n\n  describe(\"images\", function() {\n    return it(\"should convert\", function() {\n      var result, testImage;\n      testImage = atob(\"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAALUlEQVRYR+3QQREAAAABQfqXFsNnFTizzXk99+MAAQIECBAgQIAAAQIECBAgMBo/ACHo7lH9AAAAAElFTkSuQmCC\");\n      result = Images.convert([\n        {\n          path: \"images/test.png\",\n          content: testImage\n        }, {\n          path: \"images/yolo.png\",\n          content: testImage\n        }, {\n          path: \"main.coffee.md\",\n          content: \"Not an image\"\n        }\n      ]);\n      assert(result.test);\n      assert(result.yolo);\n      return assert(!result.main);\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/images.coffee",
      "type": "blob"
    },
    "test/test": {
      "path": "test/test",
      "content": "(function() {\n  describe(\"editor\", function() {\n    return it(\"should test things\", function() {\n      return assert(true);\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/test.coffee",
      "type": "blob"
    },
    "test/util": {
      "path": "test/util",
      "content": "(function() {\n  var Util;\n\n  Util = require(\"../source/util\");\n\n  describe(\"Util\", function() {\n    return it(\"should allow reading of the source config\", function() {\n      return assert(Util.readSourceConfig(PACKAGE));\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/util.coffee",
      "type": "blob"
    }
  },
  "progenitor": {
    "url": "http://strd6.github.io/editor/"
  },
  "version": "0.3.0",
  "entryPoint": "main",
  "remoteDependencies": [
    "https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.5.2/underscore-min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js",
    "https://code.jquery.com/jquery-1.10.1.min.js",
    "https://d1n0x3qji82z53.cloudfront.net/src-min-noconflict/ace.js",
    "http://www.danielx.net/tempest/javascripts/envweb-v0.4.5.js"
  ],
  "repository": {
    "id": 12478000,
    "name": "editor",
    "full_name": "STRd6/editor",
    "owner": {
      "login": "STRd6",
      "id": 18894,
      "avatar_url": "https://avatars.githubusercontent.com/u/18894",
      "gravatar_id": "33117162fff8a9cf50544a604f60c045",
      "url": "https://api.github.com/users/STRd6",
      "html_url": "https://github.com/STRd6",
      "followers_url": "https://api.github.com/users/STRd6/followers",
      "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
      "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
      "organizations_url": "https://api.github.com/users/STRd6/orgs",
      "repos_url": "https://api.github.com/users/STRd6/repos",
      "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
      "received_events_url": "https://api.github.com/users/STRd6/received_events",
      "type": "User",
      "site_admin": false
    },
    "private": false,
    "html_url": "https://github.com/STRd6/editor",
    "description": "Edit Github repos and run them in your browser.",
    "fork": false,
    "url": "https://api.github.com/repos/STRd6/editor",
    "forks_url": "https://api.github.com/repos/STRd6/editor/forks",
    "keys_url": "https://api.github.com/repos/STRd6/editor/keys{/key_id}",
    "collaborators_url": "https://api.github.com/repos/STRd6/editor/collaborators{/collaborator}",
    "teams_url": "https://api.github.com/repos/STRd6/editor/teams",
    "hooks_url": "https://api.github.com/repos/STRd6/editor/hooks",
    "issue_events_url": "https://api.github.com/repos/STRd6/editor/issues/events{/number}",
    "events_url": "https://api.github.com/repos/STRd6/editor/events",
    "assignees_url": "https://api.github.com/repos/STRd6/editor/assignees{/user}",
    "branches_url": "https://api.github.com/repos/STRd6/editor/branches{/branch}",
    "tags_url": "https://api.github.com/repos/STRd6/editor/tags",
    "blobs_url": "https://api.github.com/repos/STRd6/editor/git/blobs{/sha}",
    "git_tags_url": "https://api.github.com/repos/STRd6/editor/git/tags{/sha}",
    "git_refs_url": "https://api.github.com/repos/STRd6/editor/git/refs{/sha}",
    "trees_url": "https://api.github.com/repos/STRd6/editor/git/trees{/sha}",
    "statuses_url": "https://api.github.com/repos/STRd6/editor/statuses/{sha}",
    "languages_url": "https://api.github.com/repos/STRd6/editor/languages",
    "stargazers_url": "https://api.github.com/repos/STRd6/editor/stargazers",
    "contributors_url": "https://api.github.com/repos/STRd6/editor/contributors",
    "subscribers_url": "https://api.github.com/repos/STRd6/editor/subscribers",
    "subscription_url": "https://api.github.com/repos/STRd6/editor/subscription",
    "commits_url": "https://api.github.com/repos/STRd6/editor/commits{/sha}",
    "git_commits_url": "https://api.github.com/repos/STRd6/editor/git/commits{/sha}",
    "comments_url": "https://api.github.com/repos/STRd6/editor/comments{/number}",
    "issue_comment_url": "https://api.github.com/repos/STRd6/editor/issues/comments/{number}",
    "contents_url": "https://api.github.com/repos/STRd6/editor/contents/{+path}",
    "compare_url": "https://api.github.com/repos/STRd6/editor/compare/{base}...{head}",
    "merges_url": "https://api.github.com/repos/STRd6/editor/merges",
    "archive_url": "https://api.github.com/repos/STRd6/editor/{archive_format}{/ref}",
    "downloads_url": "https://api.github.com/repos/STRd6/editor/downloads",
    "issues_url": "https://api.github.com/repos/STRd6/editor/issues{/number}",
    "pulls_url": "https://api.github.com/repos/STRd6/editor/pulls{/number}",
    "milestones_url": "https://api.github.com/repos/STRd6/editor/milestones{/number}",
    "notifications_url": "https://api.github.com/repos/STRd6/editor/notifications{?since,all,participating}",
    "labels_url": "https://api.github.com/repos/STRd6/editor/labels{/name}",
    "releases_url": "https://api.github.com/repos/STRd6/editor/releases{/id}",
    "created_at": "2013-08-30T04:27:41Z",
    "updated_at": "2014-02-20T00:11:16Z",
    "pushed_at": "2014-02-20T00:11:16Z",
    "git_url": "git://github.com/STRd6/editor.git",
    "ssh_url": "git@github.com:STRd6/editor.git",
    "clone_url": "https://github.com/STRd6/editor.git",
    "svn_url": "https://github.com/STRd6/editor",
    "homepage": "strd6.github.io/editor",
    "size": 5625,
    "stargazers_count": 2,
    "watchers_count": 2,
    "language": "CSS",
    "has_issues": true,
    "has_downloads": true,
    "has_wiki": true,
    "forks_count": 3,
    "mirror_url": null,
    "open_issues_count": 21,
    "forks": 3,
    "open_issues": 21,
    "watchers": 2,
    "default_branch": "master",
    "master_branch": "master",
    "permissions": {
      "admin": true,
      "push": true,
      "pull": true
    },
    "network_count": 3,
    "subscribers_count": 3,
    "branch": "packager-update",
    "publishBranch": "gh-pages"
  },
  "dependencies": {
    "builder": {
      "source": {
        "LICENSE": {
          "path": "LICENSE",
          "mode": "100644",
          "content": "The MIT License (MIT)\n\nCopyright (c) 2013 distri\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
          "type": "blob"
        },
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "builder\n=======\n\nA builder for distri apps.\n",
          "type": "blob"
        },
        "TODO": {
          "path": "TODO",
          "mode": "100644",
          "content": "\n\nMove adding dependencies to a post processor.\n\nPipes instead of deferred for post processors.\n",
          "type": "blob"
        },
        "main.coffee.md": {
          "path": "main.coffee.md",
          "mode": "100644",
          "content": "Builder\n=======\n\nThe builder knows how to compile a source tree or individual files into various\nbuild products.\n\nTODO: Should the builder be part of the packager?\n\nHelpers\n-------\n    CSON = require \"cson\"\n\n    Deferred = $.Deferred\n\n    arrayToHash = (array) ->\n      array.reduce (hash, file) ->\n        hash[file.path] = file\n        hash\n      , {}\n\n    extend = (target, sources...) ->\n      for source in sources\n        for name of source\n          target[name] = source[name]\n\n      return target\n\n    fileExtension = (str) ->\n      if match = str.match(/\\.([^\\.]*)$/, '')\n        match[match.length - 1]\n      else\n        ''\n\n    withoutExtension = (str) ->\n      str.replace(/\\.[^\\.]*$/,\"\")\n\n`stripMarkdown` converts a literate file into pure code for compilation or execution.\n\n    stripMarkdown = (content) ->\n      content.split(\"\\n\").map (line) ->\n        if match = (/^([ ]{4}|\\t)/).exec line\n          line[match[0].length..]\n        else\n          \"\"\n      .join(\"\\n\")\n\n`compileTemplate` compiles a haml file into a HAMLjr program.\n\n    compileTemplate = (source) ->\n      \"\"\"\n        module.exports = Function(\"return \" + HAMLjr.compile(#{JSON.stringify(source)}, {compiler: CoffeeScript}))()\n      \"\"\"\n\n`stringData` exports a string of text. When you require a file that exports\nstring data it returns the string for you to use in your code. This is handy for\nCSS or other textually based data.\n\n    stringData = (source) ->\n      \"module.exports = #{JSON.stringify(source)};\"\n\n`compileStyl` compiles a styl file into CSS and makes it available as a string\nexport.\n\n    compileStyl = (source) ->\n      styleContent = styl(source, whitespace: true).toString()\n\n      stringData(styleContent)\n\n`compileCoffee` compiles a coffee file into JS and adds the sourceURL comment.\n\nTODO: Work with the require component to make the sourceURL unique for files in\nmodules.\n\n    compileCoffee = (source, path) ->\n      \"\"\"\n        #{CoffeeScript.compile(source)}\n        //# sourceURL=#{path}\n      \"\"\"\n\n`compileFile` take a fileData and returns a buildData. A buildData has a `path`,\nand properties for what type of content was built.\n\nTODO: Allow for files to generate docs and code at the same time.\n\n    compileFile = ({path, content}) ->\n      [name, extension] = [withoutExtension(path), fileExtension(path)]\n\n      result =\n        switch extension\n          when \"js\"\n            code: content\n          when \"json\"\n            code: stringData(JSON.parse(content))\n          when \"cson\"\n            code: stringData(CSON.parse(content))\n          when \"coffee\"\n            code: compileCoffee(content, path)\n          when \"haml\"\n            code: compileTemplate(content, name)\n          when \"styl\"\n            code: compileStyl(content)\n          when \"css\"\n            code: stringData(content)\n          when \"md\"\n            # Separate out code and call compile again\n            compileFile\n              path: name\n              content: stripMarkdown(content)\n          else\n            {}\n\n      result.name ?= name\n      result.extension ?= extension\n\n      extend result,\n        path: path\n\nBuilder\n-------\n\nThe builder instance.\n\nTODO: Standardize interface to use promises or pipes.\n\n    Builder = ->\n      build = (fileData) ->\n        results = fileData.map ({path, content}) ->\n          try\n            # TODO: Separate out tests\n\n            compileFile\n              path: path\n              content: content\n          catch {location, message}\n            if location?\n              message = \"Error on line #{location.first_line + 1}: #{message}\"\n\n            error: \"#{path} - #{message}\"\n\n        errors = results.filter (result) -> result.error\n        data = results.filter (result) -> !result.error\n\n        if errors.length\n          Deferred().reject(errors.map (e) -> e.error)\n        else\n          Deferred().resolve(data)\n\nPost processors operate on the built package.\n\nTODO: Maybe we should split post processors into the packager.\n\n      postProcessors = []\n\n      addPostProcessor: (fn) ->\n        postProcessors.push fn\n\nCompile and build a tree of file data into a distribution. The distribution should\ninclude source files, compiled files, and documentation.\n\n      build: (fileData, cache={}) ->\n        build(fileData)\n        .then (items) ->\n\n          results =\n            items.filter (item) ->\n              item.code\n            .map (item) ->\n              path: item.name\n              content: item.code\n              type: \"blob\"\n\n          source = arrayToHash(fileData)\n\n          pkg =\n            source: source\n            distribution: arrayToHash(results)\n\n          postProcessors.forEach (fn) ->\n            fn(pkg)\n\n          return pkg\n\n    module.exports = Builder\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "version: \"0.3.2\"\nentryPoint: \"main\"\nremoteDependencies: [\n  \"https://code.jquery.com/jquery-1.10.1.min.js\"\n  \"https://cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js\"\n]\ndependencies:\n  cson: \"distri/cson:v0.1.0\"\n",
          "type": "blob"
        },
        "test/builder.coffee": {
          "path": "test/builder.coffee",
          "mode": "100644",
          "content": "global.require = require\nglobal.PACKAGE = PACKAGE\n\nBuilder = require \"../main\"\n\ndescribe \"Builder\", ->\n  it \"should exist\", ->\n    assert Builder\n\n  it \"should build\", ->\n    builder = Builder()\n\n    fileData = Object.keys(PACKAGE.source).map (path) ->\n      PACKAGE.source[path]\n\n    builder.build(fileData).then (result) ->\n      console.log \"wat\"\n      console.log result\n    , (errors) ->\n      console.log errors\n",
          "type": "blob"
        }
      },
      "distribution": {
        "main": {
          "path": "main",
          "content": "(function() {\n  var Builder, CSON, Deferred, arrayToHash, compileCoffee, compileFile, compileStyl, compileTemplate, extend, fileExtension, stringData, stripMarkdown, withoutExtension,\n    __slice = [].slice;\n\n  CSON = require(\"cson\");\n\n  Deferred = $.Deferred;\n\n  arrayToHash = function(array) {\n    return array.reduce(function(hash, file) {\n      hash[file.path] = file;\n      return hash;\n    }, {});\n  };\n\n  extend = function() {\n    var name, source, sources, target, _i, _len;\n    target = arguments[0], sources = 2 <= arguments.length ? __slice.call(arguments, 1) : [];\n    for (_i = 0, _len = sources.length; _i < _len; _i++) {\n      source = sources[_i];\n      for (name in source) {\n        target[name] = source[name];\n      }\n    }\n    return target;\n  };\n\n  fileExtension = function(str) {\n    var match;\n    if (match = str.match(/\\.([^\\.]*)$/, '')) {\n      return match[match.length - 1];\n    } else {\n      return '';\n    }\n  };\n\n  withoutExtension = function(str) {\n    return str.replace(/\\.[^\\.]*$/, \"\");\n  };\n\n  stripMarkdown = function(content) {\n    return content.split(\"\\n\").map(function(line) {\n      var match;\n      if (match = /^([ ]{4}|\\t)/.exec(line)) {\n        return line.slice(match[0].length);\n      } else {\n        return \"\";\n      }\n    }).join(\"\\n\");\n  };\n\n  compileTemplate = function(source) {\n    return \"module.exports = Function(\\\"return \\\" + HAMLjr.compile(\" + (JSON.stringify(source)) + \", {compiler: CoffeeScript}))()\";\n  };\n\n  stringData = function(source) {\n    return \"module.exports = \" + (JSON.stringify(source)) + \";\";\n  };\n\n  compileStyl = function(source) {\n    var styleContent;\n    styleContent = styl(source, {\n      whitespace: true\n    }).toString();\n    return stringData(styleContent);\n  };\n\n  compileCoffee = function(source, path) {\n    return \"\" + (CoffeeScript.compile(source)) + \"\\n//# sourceURL=\" + path;\n  };\n\n  compileFile = function(_arg) {\n    var content, extension, name, path, result, _ref;\n    path = _arg.path, content = _arg.content;\n    _ref = [withoutExtension(path), fileExtension(path)], name = _ref[0], extension = _ref[1];\n    result = (function() {\n      switch (extension) {\n        case \"js\":\n          return {\n            code: content\n          };\n        case \"json\":\n          return {\n            code: stringData(JSON.parse(content))\n          };\n        case \"cson\":\n          return {\n            code: stringData(CSON.parse(content))\n          };\n        case \"coffee\":\n          return {\n            code: compileCoffee(content, path)\n          };\n        case \"haml\":\n          return {\n            code: compileTemplate(content, name)\n          };\n        case \"styl\":\n          return {\n            code: compileStyl(content)\n          };\n        case \"css\":\n          return {\n            code: stringData(content)\n          };\n        case \"md\":\n          return compileFile({\n            path: name,\n            content: stripMarkdown(content)\n          });\n        default:\n          return {};\n      }\n    })();\n    if (result.name == null) {\n      result.name = name;\n    }\n    if (result.extension == null) {\n      result.extension = extension;\n    }\n    return extend(result, {\n      path: path\n    });\n  };\n\n  Builder = function() {\n    var build, postProcessors;\n    build = function(fileData) {\n      var data, errors, results;\n      results = fileData.map(function(_arg) {\n        var content, location, message, path;\n        path = _arg.path, content = _arg.content;\n        try {\n          return compileFile({\n            path: path,\n            content: content\n          });\n        } catch (_error) {\n          location = _error.location, message = _error.message;\n          if (location != null) {\n            message = \"Error on line \" + (location.first_line + 1) + \": \" + message;\n          }\n          return {\n            error: \"\" + path + \" - \" + message\n          };\n        }\n      });\n      errors = results.filter(function(result) {\n        return result.error;\n      });\n      data = results.filter(function(result) {\n        return !result.error;\n      });\n      if (errors.length) {\n        return Deferred().reject(errors.map(function(e) {\n          return e.error;\n        }));\n      } else {\n        return Deferred().resolve(data);\n      }\n    };\n    postProcessors = [];\n    return {\n      addPostProcessor: function(fn) {\n        return postProcessors.push(fn);\n      },\n      build: function(fileData, cache) {\n        if (cache == null) {\n          cache = {};\n        }\n        return build(fileData).then(function(items) {\n          var pkg, results, source;\n          results = items.filter(function(item) {\n            return item.code;\n          }).map(function(item) {\n            return {\n              path: item.name,\n              content: item.code,\n              type: \"blob\"\n            };\n          });\n          source = arrayToHash(fileData);\n          pkg = {\n            source: source,\n            distribution: arrayToHash(results)\n          };\n          postProcessors.forEach(function(fn) {\n            return fn(pkg);\n          });\n          return pkg;\n        });\n      }\n    };\n  };\n\n  module.exports = Builder;\n\n}).call(this);\n\n//# sourceURL=main.coffee",
          "type": "blob"
        },
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"version\":\"0.3.2\",\"entryPoint\":\"main\",\"remoteDependencies\":[\"https://code.jquery.com/jquery-1.10.1.min.js\",\"https://cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js\"],\"dependencies\":{\"cson\":\"distri/cson:v0.1.0\"}};",
          "type": "blob"
        },
        "test/builder": {
          "path": "test/builder",
          "content": "(function() {\n  var Builder;\n\n  global.require = require;\n\n  global.PACKAGE = PACKAGE;\n\n  Builder = require(\"../main\");\n\n  describe(\"Builder\", function() {\n    it(\"should exist\", function() {\n      return assert(Builder);\n    });\n    return it(\"should build\", function() {\n      var builder, fileData;\n      builder = Builder();\n      fileData = Object.keys(PACKAGE.source).map(function(path) {\n        return PACKAGE.source[path];\n      });\n      return builder.build(fileData).then(function(result) {\n        console.log(\"wat\");\n        return console.log(result);\n      }, function(errors) {\n        return console.log(errors);\n      });\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/builder.coffee",
          "type": "blob"
        }
      },
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "version": "0.3.2",
      "entryPoint": "main",
      "remoteDependencies": [
        "https://code.jquery.com/jquery-1.10.1.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js"
      ],
      "repository": {
        "id": 14807528,
        "name": "builder",
        "full_name": "distri/builder",
        "owner": {
          "login": "distri",
          "id": 6005125,
          "avatar_url": "https://identicons.github.com/f90c81ffc1498e260c820082f2e7ca5f.png",
          "gravatar_id": null,
          "url": "https://api.github.com/users/distri",
          "html_url": "https://github.com/distri",
          "followers_url": "https://api.github.com/users/distri/followers",
          "following_url": "https://api.github.com/users/distri/following{/other_user}",
          "gists_url": "https://api.github.com/users/distri/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/distri/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/distri/subscriptions",
          "organizations_url": "https://api.github.com/users/distri/orgs",
          "repos_url": "https://api.github.com/users/distri/repos",
          "events_url": "https://api.github.com/users/distri/events{/privacy}",
          "received_events_url": "https://api.github.com/users/distri/received_events",
          "type": "Organization",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/distri/builder",
        "description": "A builder for distri apps.",
        "fork": false,
        "url": "https://api.github.com/repos/distri/builder",
        "forks_url": "https://api.github.com/repos/distri/builder/forks",
        "keys_url": "https://api.github.com/repos/distri/builder/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/distri/builder/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/distri/builder/teams",
        "hooks_url": "https://api.github.com/repos/distri/builder/hooks",
        "issue_events_url": "https://api.github.com/repos/distri/builder/issues/events{/number}",
        "events_url": "https://api.github.com/repos/distri/builder/events",
        "assignees_url": "https://api.github.com/repos/distri/builder/assignees{/user}",
        "branches_url": "https://api.github.com/repos/distri/builder/branches{/branch}",
        "tags_url": "https://api.github.com/repos/distri/builder/tags",
        "blobs_url": "https://api.github.com/repos/distri/builder/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/distri/builder/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/distri/builder/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/distri/builder/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/distri/builder/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/distri/builder/languages",
        "stargazers_url": "https://api.github.com/repos/distri/builder/stargazers",
        "contributors_url": "https://api.github.com/repos/distri/builder/contributors",
        "subscribers_url": "https://api.github.com/repos/distri/builder/subscribers",
        "subscription_url": "https://api.github.com/repos/distri/builder/subscription",
        "commits_url": "https://api.github.com/repos/distri/builder/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/distri/builder/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/distri/builder/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/distri/builder/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/distri/builder/contents/{+path}",
        "compare_url": "https://api.github.com/repos/distri/builder/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/distri/builder/merges",
        "archive_url": "https://api.github.com/repos/distri/builder/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/distri/builder/downloads",
        "issues_url": "https://api.github.com/repos/distri/builder/issues{/number}",
        "pulls_url": "https://api.github.com/repos/distri/builder/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/distri/builder/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/distri/builder/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/distri/builder/labels{/name}",
        "releases_url": "https://api.github.com/repos/distri/builder/releases{/id}",
        "created_at": "2013-11-29T17:58:27Z",
        "updated_at": "2014-02-11T19:10:44Z",
        "pushed_at": "2014-02-11T19:10:43Z",
        "git_url": "git://github.com/distri/builder.git",
        "ssh_url": "git@github.com:distri/builder.git",
        "clone_url": "https://github.com/distri/builder.git",
        "svn_url": "https://github.com/distri/builder",
        "homepage": null,
        "size": 224,
        "stargazers_count": 0,
        "watchers_count": 0,
        "language": "CoffeeScript",
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "default_branch": "master",
        "master_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "organization": {
          "login": "distri",
          "id": 6005125,
          "avatar_url": "https://identicons.github.com/f90c81ffc1498e260c820082f2e7ca5f.png",
          "gravatar_id": null,
          "url": "https://api.github.com/users/distri",
          "html_url": "https://github.com/distri",
          "followers_url": "https://api.github.com/users/distri/followers",
          "following_url": "https://api.github.com/users/distri/following{/other_user}",
          "gists_url": "https://api.github.com/users/distri/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/distri/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/distri/subscriptions",
          "organizations_url": "https://api.github.com/users/distri/orgs",
          "repos_url": "https://api.github.com/users/distri/repos",
          "events_url": "https://api.github.com/users/distri/events{/privacy}",
          "received_events_url": "https://api.github.com/users/distri/received_events",
          "type": "Organization",
          "site_admin": false
        },
        "network_count": 0,
        "subscribers_count": 2,
        "branch": "v0.3.2",
        "defaultBranch": "master"
      },
      "dependencies": {
        "cson": {
          "source": {
            "LICENSE": {
              "path": "LICENSE",
              "mode": "100644",
              "content": "The MIT License (MIT)\n\nCopyright (c) 2014 distri\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
              "type": "blob"
            },
            "pixie.cson": {
              "path": "pixie.cson",
              "mode": "100644",
              "content": "entryPoint: \"README\"\nversion: \"0.1.0\"\nremoteDependencies: [\n  \"https://cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js\"\n]\n",
              "type": "blob"
            },
            "README.coffee.md": {
              "path": "README.coffee.md",
              "mode": "100644",
              "content": "CSON\n====\n\nCoffeeScript Object Notation implemented in the hackiest way.\n\nOne downside is that it currently depends on the CoffeeScript compiler when it \nshould be a simple parser of its own.\n\n    module.exports =\n      parse: (source) ->\n        Function(\"return #{CoffeeScript.compile(source, bare: true)}\")()\n\nThis really needs to be improved. To do it correctly we'd need to detect\nobject/array values and indent while moving them to separate lines. Single\nvalues would exist without newlines or indentation. CSON.stringify would be\ncalled recursively.\n\nThe current hack of using JSON works because JSON is valid CSON.\n\nTODO: Escape keys that need it.\n\n      stringify: (object) ->\n        representation = JSON.parse(JSON.stringify(obj))\n\n        Object.keys(representation).map (key) ->\n          value = representation[key]\n          \"#{key}: #{JSON.stringify(value)}\"\n        .join(\"\\n\")\n",
              "type": "blob"
            },
            "test/cson.coffee": {
              "path": "test/cson.coffee",
              "mode": "100644",
              "content": "CSON = require \"../README\"\n\ndescribe \"CSON\", ->\n  it \"should parse\", ->\n    result = CSON.parse \"\"\"\n      hello: \"duder\"\n    \"\"\"\n\n    assert result.hello\n    assert.equal result.hello, \"duder\"\n\n  it \"should allow comments\", ->\n    result = CSON.parse \"\"\"\n      # Some comment\n      hey: \"yolo\" # Fo 'sho!\n    \"\"\"\n\n    assert.equal result.hey, \"yolo\"\n",
              "type": "blob"
            }
          },
          "distribution": {
            "pixie": {
              "path": "pixie",
              "content": "module.exports = {\"entryPoint\":\"README\",\"version\":\"0.1.0\",\"remoteDependencies\":[\"https://cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js\"]};",
              "type": "blob"
            },
            "README": {
              "path": "README",
              "content": "(function() {\n  module.exports = {\n    parse: function(source) {\n      return Function(\"return \" + (CoffeeScript.compile(source, {\n        bare: true\n      })))();\n    },\n    stringify: function(object) {\n      var representation;\n      representation = JSON.parse(JSON.stringify(obj));\n      return Object.keys(representation).map(function(key) {\n        var value;\n        value = representation[key];\n        return \"\" + key + \": \" + (JSON.stringify(value));\n      }).join(\"\\n\");\n    }\n  };\n\n}).call(this);\n\n//# sourceURL=README.coffee",
              "type": "blob"
            },
            "test/cson": {
              "path": "test/cson",
              "content": "(function() {\n  var CSON;\n\n  CSON = require(\"../README\");\n\n  describe(\"CSON\", function() {\n    it(\"should parse\", function() {\n      var result;\n      result = CSON.parse(\"hello: \\\"duder\\\"\");\n      assert(result.hello);\n      return assert.equal(result.hello, \"duder\");\n    });\n    return it(\"should allow comments\", function() {\n      var result;\n      result = CSON.parse(\"# Some comment\\nhey: \\\"yolo\\\" # Fo 'sho!\");\n      return assert.equal(result.hey, \"yolo\");\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/cson.coffee",
              "type": "blob"
            }
          },
          "progenitor": {
            "url": "http://strd6.github.io/editor/"
          },
          "version": "0.1.0",
          "entryPoint": "README",
          "remoteDependencies": [
            "https://cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js"
          ],
          "repository": {
            "id": 16653973,
            "name": "cson",
            "full_name": "distri/cson",
            "owner": {
              "login": "distri",
              "id": 6005125,
              "avatar_url": "https://identicons.github.com/f90c81ffc1498e260c820082f2e7ca5f.png",
              "gravatar_id": null,
              "url": "https://api.github.com/users/distri",
              "html_url": "https://github.com/distri",
              "followers_url": "https://api.github.com/users/distri/followers",
              "following_url": "https://api.github.com/users/distri/following{/other_user}",
              "gists_url": "https://api.github.com/users/distri/gists{/gist_id}",
              "starred_url": "https://api.github.com/users/distri/starred{/owner}{/repo}",
              "subscriptions_url": "https://api.github.com/users/distri/subscriptions",
              "organizations_url": "https://api.github.com/users/distri/orgs",
              "repos_url": "https://api.github.com/users/distri/repos",
              "events_url": "https://api.github.com/users/distri/events{/privacy}",
              "received_events_url": "https://api.github.com/users/distri/received_events",
              "type": "Organization",
              "site_admin": false
            },
            "private": false,
            "html_url": "https://github.com/distri/cson",
            "description": "CoffeeScript Object Notation implemented in the hackiest way.",
            "fork": false,
            "url": "https://api.github.com/repos/distri/cson",
            "forks_url": "https://api.github.com/repos/distri/cson/forks",
            "keys_url": "https://api.github.com/repos/distri/cson/keys{/key_id}",
            "collaborators_url": "https://api.github.com/repos/distri/cson/collaborators{/collaborator}",
            "teams_url": "https://api.github.com/repos/distri/cson/teams",
            "hooks_url": "https://api.github.com/repos/distri/cson/hooks",
            "issue_events_url": "https://api.github.com/repos/distri/cson/issues/events{/number}",
            "events_url": "https://api.github.com/repos/distri/cson/events",
            "assignees_url": "https://api.github.com/repos/distri/cson/assignees{/user}",
            "branches_url": "https://api.github.com/repos/distri/cson/branches{/branch}",
            "tags_url": "https://api.github.com/repos/distri/cson/tags",
            "blobs_url": "https://api.github.com/repos/distri/cson/git/blobs{/sha}",
            "git_tags_url": "https://api.github.com/repos/distri/cson/git/tags{/sha}",
            "git_refs_url": "https://api.github.com/repos/distri/cson/git/refs{/sha}",
            "trees_url": "https://api.github.com/repos/distri/cson/git/trees{/sha}",
            "statuses_url": "https://api.github.com/repos/distri/cson/statuses/{sha}",
            "languages_url": "https://api.github.com/repos/distri/cson/languages",
            "stargazers_url": "https://api.github.com/repos/distri/cson/stargazers",
            "contributors_url": "https://api.github.com/repos/distri/cson/contributors",
            "subscribers_url": "https://api.github.com/repos/distri/cson/subscribers",
            "subscription_url": "https://api.github.com/repos/distri/cson/subscription",
            "commits_url": "https://api.github.com/repos/distri/cson/commits{/sha}",
            "git_commits_url": "https://api.github.com/repos/distri/cson/git/commits{/sha}",
            "comments_url": "https://api.github.com/repos/distri/cson/comments{/number}",
            "issue_comment_url": "https://api.github.com/repos/distri/cson/issues/comments/{number}",
            "contents_url": "https://api.github.com/repos/distri/cson/contents/{+path}",
            "compare_url": "https://api.github.com/repos/distri/cson/compare/{base}...{head}",
            "merges_url": "https://api.github.com/repos/distri/cson/merges",
            "archive_url": "https://api.github.com/repos/distri/cson/{archive_format}{/ref}",
            "downloads_url": "https://api.github.com/repos/distri/cson/downloads",
            "issues_url": "https://api.github.com/repos/distri/cson/issues{/number}",
            "pulls_url": "https://api.github.com/repos/distri/cson/pulls{/number}",
            "milestones_url": "https://api.github.com/repos/distri/cson/milestones{/number}",
            "notifications_url": "https://api.github.com/repos/distri/cson/notifications{?since,all,participating}",
            "labels_url": "https://api.github.com/repos/distri/cson/labels{/name}",
            "releases_url": "https://api.github.com/repos/distri/cson/releases{/id}",
            "created_at": "2014-02-08T21:52:30Z",
            "updated_at": "2014-02-08T21:52:30Z",
            "pushed_at": "2014-02-08T21:52:30Z",
            "git_url": "git://github.com/distri/cson.git",
            "ssh_url": "git@github.com:distri/cson.git",
            "clone_url": "https://github.com/distri/cson.git",
            "svn_url": "https://github.com/distri/cson",
            "homepage": null,
            "size": 0,
            "stargazers_count": 0,
            "watchers_count": 0,
            "language": null,
            "has_issues": true,
            "has_downloads": true,
            "has_wiki": true,
            "forks_count": 0,
            "mirror_url": null,
            "open_issues_count": 0,
            "forks": 0,
            "open_issues": 0,
            "watchers": 0,
            "default_branch": "master",
            "master_branch": "master",
            "permissions": {
              "admin": true,
              "push": true,
              "pull": true
            },
            "organization": {
              "login": "distri",
              "id": 6005125,
              "avatar_url": "https://identicons.github.com/f90c81ffc1498e260c820082f2e7ca5f.png",
              "gravatar_id": null,
              "url": "https://api.github.com/users/distri",
              "html_url": "https://github.com/distri",
              "followers_url": "https://api.github.com/users/distri/followers",
              "following_url": "https://api.github.com/users/distri/following{/other_user}",
              "gists_url": "https://api.github.com/users/distri/gists{/gist_id}",
              "starred_url": "https://api.github.com/users/distri/starred{/owner}{/repo}",
              "subscriptions_url": "https://api.github.com/users/distri/subscriptions",
              "organizations_url": "https://api.github.com/users/distri/orgs",
              "repos_url": "https://api.github.com/users/distri/repos",
              "events_url": "https://api.github.com/users/distri/events{/privacy}",
              "received_events_url": "https://api.github.com/users/distri/received_events",
              "type": "Organization",
              "site_admin": false
            },
            "network_count": 0,
            "subscribers_count": 2,
            "branch": "v0.1.0",
            "defaultBranch": "master"
          },
          "dependencies": {},
          "name": "cson"
        }
      },
      "name": "builder"
    },
    "cson": {
      "source": {
        "LICENSE": {
          "path": "LICENSE",
          "mode": "100644",
          "content": "The MIT License (MIT)\n\nCopyright (c) 2014 distri\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "entryPoint: \"README\"\nversion: \"0.1.0\"\nremoteDependencies: [\n  \"https://cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js\"\n]\n",
          "type": "blob"
        },
        "README.coffee.md": {
          "path": "README.coffee.md",
          "mode": "100644",
          "content": "CSON\n====\n\nCoffeeScript Object Notation implemented in the hackiest way.\n\nOne downside is that it currently depends on the CoffeeScript compiler when it \nshould be a simple parser of its own.\n\n    module.exports =\n      parse: (source) ->\n        Function(\"return #{CoffeeScript.compile(source, bare: true)}\")()\n\nThis really needs to be improved. To do it correctly we'd need to detect\nobject/array values and indent while moving them to separate lines. Single\nvalues would exist without newlines or indentation. CSON.stringify would be\ncalled recursively.\n\nThe current hack of using JSON works because JSON is valid CSON.\n\nTODO: Escape keys that need it.\n\n      stringify: (object) ->\n        representation = JSON.parse(JSON.stringify(obj))\n\n        Object.keys(representation).map (key) ->\n          value = representation[key]\n          \"#{key}: #{JSON.stringify(value)}\"\n        .join(\"\\n\")\n",
          "type": "blob"
        },
        "test/cson.coffee": {
          "path": "test/cson.coffee",
          "mode": "100644",
          "content": "CSON = require \"../README\"\n\ndescribe \"CSON\", ->\n  it \"should parse\", ->\n    result = CSON.parse \"\"\"\n      hello: \"duder\"\n    \"\"\"\n\n    assert result.hello\n    assert.equal result.hello, \"duder\"\n\n  it \"should allow comments\", ->\n    result = CSON.parse \"\"\"\n      # Some comment\n      hey: \"yolo\" # Fo 'sho!\n    \"\"\"\n\n    assert.equal result.hey, \"yolo\"\n",
          "type": "blob"
        }
      },
      "distribution": {
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"entryPoint\":\"README\",\"version\":\"0.1.0\",\"remoteDependencies\":[\"https://cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js\"]};",
          "type": "blob"
        },
        "README": {
          "path": "README",
          "content": "(function() {\n  module.exports = {\n    parse: function(source) {\n      return Function(\"return \" + (CoffeeScript.compile(source, {\n        bare: true\n      })))();\n    },\n    stringify: function(object) {\n      var representation;\n      representation = JSON.parse(JSON.stringify(obj));\n      return Object.keys(representation).map(function(key) {\n        var value;\n        value = representation[key];\n        return \"\" + key + \": \" + (JSON.stringify(value));\n      }).join(\"\\n\");\n    }\n  };\n\n}).call(this);\n\n//# sourceURL=README.coffee",
          "type": "blob"
        },
        "test/cson": {
          "path": "test/cson",
          "content": "(function() {\n  var CSON;\n\n  CSON = require(\"../README\");\n\n  describe(\"CSON\", function() {\n    it(\"should parse\", function() {\n      var result;\n      result = CSON.parse(\"hello: \\\"duder\\\"\");\n      assert(result.hello);\n      return assert.equal(result.hello, \"duder\");\n    });\n    return it(\"should allow comments\", function() {\n      var result;\n      result = CSON.parse(\"# Some comment\\nhey: \\\"yolo\\\" # Fo 'sho!\");\n      return assert.equal(result.hey, \"yolo\");\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/cson.coffee",
          "type": "blob"
        }
      },
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "version": "0.1.0",
      "entryPoint": "README",
      "remoteDependencies": [
        "https://cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js"
      ],
      "repository": {
        "id": 16653973,
        "name": "cson",
        "full_name": "distri/cson",
        "owner": {
          "login": "distri",
          "id": 6005125,
          "avatar_url": "https://identicons.github.com/f90c81ffc1498e260c820082f2e7ca5f.png",
          "gravatar_id": null,
          "url": "https://api.github.com/users/distri",
          "html_url": "https://github.com/distri",
          "followers_url": "https://api.github.com/users/distri/followers",
          "following_url": "https://api.github.com/users/distri/following{/other_user}",
          "gists_url": "https://api.github.com/users/distri/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/distri/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/distri/subscriptions",
          "organizations_url": "https://api.github.com/users/distri/orgs",
          "repos_url": "https://api.github.com/users/distri/repos",
          "events_url": "https://api.github.com/users/distri/events{/privacy}",
          "received_events_url": "https://api.github.com/users/distri/received_events",
          "type": "Organization",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/distri/cson",
        "description": "CoffeeScript Object Notation implemented in the hackiest way.",
        "fork": false,
        "url": "https://api.github.com/repos/distri/cson",
        "forks_url": "https://api.github.com/repos/distri/cson/forks",
        "keys_url": "https://api.github.com/repos/distri/cson/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/distri/cson/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/distri/cson/teams",
        "hooks_url": "https://api.github.com/repos/distri/cson/hooks",
        "issue_events_url": "https://api.github.com/repos/distri/cson/issues/events{/number}",
        "events_url": "https://api.github.com/repos/distri/cson/events",
        "assignees_url": "https://api.github.com/repos/distri/cson/assignees{/user}",
        "branches_url": "https://api.github.com/repos/distri/cson/branches{/branch}",
        "tags_url": "https://api.github.com/repos/distri/cson/tags",
        "blobs_url": "https://api.github.com/repos/distri/cson/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/distri/cson/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/distri/cson/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/distri/cson/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/distri/cson/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/distri/cson/languages",
        "stargazers_url": "https://api.github.com/repos/distri/cson/stargazers",
        "contributors_url": "https://api.github.com/repos/distri/cson/contributors",
        "subscribers_url": "https://api.github.com/repos/distri/cson/subscribers",
        "subscription_url": "https://api.github.com/repos/distri/cson/subscription",
        "commits_url": "https://api.github.com/repos/distri/cson/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/distri/cson/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/distri/cson/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/distri/cson/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/distri/cson/contents/{+path}",
        "compare_url": "https://api.github.com/repos/distri/cson/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/distri/cson/merges",
        "archive_url": "https://api.github.com/repos/distri/cson/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/distri/cson/downloads",
        "issues_url": "https://api.github.com/repos/distri/cson/issues{/number}",
        "pulls_url": "https://api.github.com/repos/distri/cson/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/distri/cson/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/distri/cson/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/distri/cson/labels{/name}",
        "releases_url": "https://api.github.com/repos/distri/cson/releases{/id}",
        "created_at": "2014-02-08T21:52:30Z",
        "updated_at": "2014-02-08T21:52:30Z",
        "pushed_at": "2014-02-08T21:52:30Z",
        "git_url": "git://github.com/distri/cson.git",
        "ssh_url": "git@github.com:distri/cson.git",
        "clone_url": "https://github.com/distri/cson.git",
        "svn_url": "https://github.com/distri/cson",
        "homepage": null,
        "size": 0,
        "stargazers_count": 0,
        "watchers_count": 0,
        "language": null,
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "default_branch": "master",
        "master_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "organization": {
          "login": "distri",
          "id": 6005125,
          "avatar_url": "https://identicons.github.com/f90c81ffc1498e260c820082f2e7ca5f.png",
          "gravatar_id": null,
          "url": "https://api.github.com/users/distri",
          "html_url": "https://github.com/distri",
          "followers_url": "https://api.github.com/users/distri/followers",
          "following_url": "https://api.github.com/users/distri/following{/other_user}",
          "gists_url": "https://api.github.com/users/distri/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/distri/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/distri/subscriptions",
          "organizations_url": "https://api.github.com/users/distri/orgs",
          "repos_url": "https://api.github.com/users/distri/repos",
          "events_url": "https://api.github.com/users/distri/events{/privacy}",
          "received_events_url": "https://api.github.com/users/distri/received_events",
          "type": "Organization",
          "site_admin": false
        },
        "network_count": 0,
        "subscribers_count": 2,
        "branch": "v0.1.0",
        "defaultBranch": "master"
      },
      "dependencies": {},
      "name": "cson"
    },
    "issues": {
      "source": {
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "issues\n======\n\nGithub's got issues\n\nGoal\n----\n\nCurrently just provides a dropdown list for choosing an issue from.\n\nMay later expand to forms to create/show/comment on issues for a project.\n",
          "type": "blob"
        },
        "main.coffee.md": {
          "path": "main.coffee.md",
          "mode": "100644",
          "content": "Our main entry point which exports all of our Issue models and templates.\n\n    module.exports =\n      models:\n        Issue: require(\"./source/issue\")\n        Issues: require(\"./source/issues\")\n      templates:\n        issues: require(\"./templates/issues\")\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "version: \"0.2.0\"\nentryPoint: \"main\"\n",
          "type": "blob"
        },
        "source/issue.coffee.md": {
          "path": "source/issue.coffee.md",
          "mode": "100644",
          "content": "A tempest model that wraps issues from github.\n\n    Issue = (I={}) ->\n      self = Model(I)\n\n      self.extend\n\nThe option text is what appears in the dropdown menu.\n\n        optionText: ->\n          \"#{I.title}\"\n\n        fullDescription: ->\n          \"\"\"\n            #{self.optionText()}\n            #{I.html_url}\n            #{I.body}\n          \"\"\"\n\nA helper method to get a standard branch name for an issue. Pull requests have\ntheir own branches, but an issue branch is generated based on issue number.\n\n        branchName: ->\n          I.head?.ref or \"issue-#{I.number}\"\n\n      return self\n\n    module.exports = Issue\n",
          "type": "blob"
        },
        "source/issues.coffee.md": {
          "path": "source/issues.coffee.md",
          "mode": "100644",
          "content": "    Issue = require \"./issue\"\n\nA collection of issues including a `currentIssue` to represent the actively\nselected issue.\n\nWe may want to formalize this collection pattern later, but for now lets just\nsee how it goes.\n\n    Issues = (I={}) ->\n      Object.defaults I,\n        issues: []\n\n      self = Model(I)\n\nOur `issues` method is a list of `Issue` models.\n\n      self.attrModels \"issues\", Issue\n\nWe want to expose the currently selected issue as an observable as well.\n\n      self.attrObservable \"currentIssue\"\n\n      self.extend\n\nThe reset method accepts an array of raw issue data, converts it into an array\nof issue objects, replaces the previous issues with the new ones and clears the\nselected issue.\n\n        reset: (issueData) ->\n          self.currentIssue(undefined)\n          self.issues issueData.map(Issue)\n\n      return self\n\n    module.exports = Issues\n",
          "type": "blob"
        },
        "templates/issues.haml.md": {
          "path": "templates/issues.haml.md",
          "mode": "100644",
          "content": "A simple select element to allow choosing of issues.\n\n    %select\n      - on \"change\", @currentIssue\n      %option= \"- Default Branch -\"\n      - each @issues, ->\n        %option= @optionText()\n",
          "type": "blob"
        }
      },
      "distribution": {
        "main": {
          "path": "main",
          "content": "(function() {\n  module.exports = {\n    models: {\n      Issue: require(\"./source/issue\"),\n      Issues: require(\"./source/issues\")\n    },\n    templates: {\n      issues: require(\"./templates/issues\")\n    }\n  };\n\n}).call(this);\n\n//# sourceURL=main.coffee",
          "type": "blob"
        },
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"version\":\"0.2.0\",\"entryPoint\":\"main\"};",
          "type": "blob"
        },
        "source/issue": {
          "path": "source/issue",
          "content": "(function() {\n  var Issue;\n\n  Issue = function(I) {\n    var self;\n    if (I == null) {\n      I = {};\n    }\n    self = Model(I);\n    self.extend({\n      optionText: function() {\n        return \"\" + I.title;\n      },\n      fullDescription: function() {\n        return \"\" + (self.optionText()) + \"\\n\" + I.html_url + \"\\n\" + I.body;\n      },\n      branchName: function() {\n        var _ref;\n        return ((_ref = I.head) != null ? _ref.ref : void 0) || (\"issue-\" + I.number);\n      }\n    });\n    return self;\n  };\n\n  module.exports = Issue;\n\n}).call(this);\n\n//# sourceURL=source/issue.coffee",
          "type": "blob"
        },
        "source/issues": {
          "path": "source/issues",
          "content": "(function() {\n  var Issue, Issues;\n\n  Issue = require(\"./issue\");\n\n  Issues = function(I) {\n    var self;\n    if (I == null) {\n      I = {};\n    }\n    Object.defaults(I, {\n      issues: []\n    });\n    self = Model(I);\n    self.attrModels(\"issues\", Issue);\n    self.attrObservable(\"currentIssue\");\n    self.extend({\n      reset: function(issueData) {\n        self.currentIssue(void 0);\n        return self.issues(issueData.map(Issue));\n      }\n    });\n    return self;\n  };\n\n  module.exports = Issues;\n\n}).call(this);\n\n//# sourceURL=source/issues.coffee",
          "type": "blob"
        },
        "templates/issues": {
          "path": "templates/issues",
          "content": "module.exports = Function(\"return \" + HAMLjr.compile(\"\\n\\n%select\\n  - on \\\"change\\\", @currentIssue\\n  %option= \\\"- Default Branch -\\\"\\n  - each @issues, ->\\n    %option= @optionText()\\n\", {compiler: CoffeeScript}))()",
          "type": "blob"
        }
      },
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "version": "0.2.0",
      "entryPoint": "main",
      "repository": {
        "id": 12632346,
        "name": "issues",
        "full_name": "STRd6/issues",
        "owner": {
          "login": "STRd6",
          "id": 18894,
          "avatar_url": "https://1.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
          "gravatar_id": "33117162fff8a9cf50544a604f60c045",
          "url": "https://api.github.com/users/STRd6",
          "html_url": "https://github.com/STRd6",
          "followers_url": "https://api.github.com/users/STRd6/followers",
          "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
          "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
          "organizations_url": "https://api.github.com/users/STRd6/orgs",
          "repos_url": "https://api.github.com/users/STRd6/repos",
          "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
          "received_events_url": "https://api.github.com/users/STRd6/received_events",
          "type": "User",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/STRd6/issues",
        "description": "Github's got issues",
        "fork": false,
        "url": "https://api.github.com/repos/STRd6/issues",
        "forks_url": "https://api.github.com/repos/STRd6/issues/forks",
        "keys_url": "https://api.github.com/repos/STRd6/issues/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/STRd6/issues/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/STRd6/issues/teams",
        "hooks_url": "https://api.github.com/repos/STRd6/issues/hooks",
        "issue_events_url": "https://api.github.com/repos/STRd6/issues/issues/events{/number}",
        "events_url": "https://api.github.com/repos/STRd6/issues/events",
        "assignees_url": "https://api.github.com/repos/STRd6/issues/assignees{/user}",
        "branches_url": "https://api.github.com/repos/STRd6/issues/branches{/branch}",
        "tags_url": "https://api.github.com/repos/STRd6/issues/tags",
        "blobs_url": "https://api.github.com/repos/STRd6/issues/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/STRd6/issues/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/STRd6/issues/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/STRd6/issues/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/STRd6/issues/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/STRd6/issues/languages",
        "stargazers_url": "https://api.github.com/repos/STRd6/issues/stargazers",
        "contributors_url": "https://api.github.com/repos/STRd6/issues/contributors",
        "subscribers_url": "https://api.github.com/repos/STRd6/issues/subscribers",
        "subscription_url": "https://api.github.com/repos/STRd6/issues/subscription",
        "commits_url": "https://api.github.com/repos/STRd6/issues/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/STRd6/issues/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/STRd6/issues/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/STRd6/issues/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/STRd6/issues/contents/{+path}",
        "compare_url": "https://api.github.com/repos/STRd6/issues/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/STRd6/issues/merges",
        "archive_url": "https://api.github.com/repos/STRd6/issues/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/STRd6/issues/downloads",
        "issues_url": "https://api.github.com/repos/STRd6/issues/issues{/number}",
        "pulls_url": "https://api.github.com/repos/STRd6/issues/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/STRd6/issues/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/STRd6/issues/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/STRd6/issues/labels{/name}",
        "releases_url": "https://api.github.com/repos/STRd6/issues/releases{/id}",
        "created_at": "2013-09-06T00:35:16Z",
        "updated_at": "2013-11-03T19:09:38Z",
        "pushed_at": "2013-11-03T19:09:37Z",
        "git_url": "git://github.com/STRd6/issues.git",
        "ssh_url": "git@github.com:STRd6/issues.git",
        "clone_url": "https://github.com/STRd6/issues.git",
        "svn_url": "https://github.com/STRd6/issues",
        "homepage": null,
        "size": 1896,
        "stargazers_count": 0,
        "watchers_count": 0,
        "language": "JavaScript",
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "default_branch": "master",
        "master_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "network_count": 0,
        "subscribers_count": 1,
        "branch": "v0.2.0",
        "defaultBranch": "master"
      },
      "dependencies": {},
      "name": "issues"
    },
    "sandbox": {
      "source": {
        "LICENSE": {
          "path": "LICENSE",
          "mode": "100644",
          "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
          "type": "blob"
        },
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "sandbox\n=======\n\nRun code in a popup window filled with sand.\n",
          "type": "blob"
        },
        "main.coffee.md": {
          "path": "main.coffee.md",
          "mode": "100644",
          "content": "Sandbox\n=======\n\nSandbox creates a popup window in which you can run code.\n\nYou can pass in a width and a height to set the size of the window.\n\n    module.exports = ({name, width, height, methods}={}) ->\n      name ?= \"sandbox\" + new Date\n      width ?= 800\n      height ?= 600\n      methods ?= {}\n\n      sandbox = window.open(\n        \"\"\n        name\n        \"width=#{width},height=#{height}\"\n      )\n\nPass in functions to attach to the running window. Useful for things like\n`onerror` or other utilities if you would like the running code to be able to\ncommunicate back to the parent.\n\n      Object.extend sandbox, methods\n\nThe newly created window is returned.\n\n      return sandbox\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "version: \"0.2.0\"\n",
          "type": "blob"
        }
      },
      "distribution": {
        "main": {
          "path": "main",
          "content": "(function() {\n  module.exports = function(_arg) {\n    var height, methods, name, sandbox, width, _ref;\n    _ref = _arg != null ? _arg : {}, name = _ref.name, width = _ref.width, height = _ref.height, methods = _ref.methods;\n    if (name == null) {\n      name = \"sandbox\" + new Date;\n    }\n    if (width == null) {\n      width = 800;\n    }\n    if (height == null) {\n      height = 600;\n    }\n    if (methods == null) {\n      methods = {};\n    }\n    sandbox = window.open(\"\", name, \"width=\" + width + \",height=\" + height);\n    Object.extend(sandbox, methods);\n    return sandbox;\n  };\n\n}).call(this);\n\n//# sourceURL=main.coffee",
          "type": "blob"
        },
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"version\":\"0.2.0\"};",
          "type": "blob"
        }
      },
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "version": "0.2.0",
      "entryPoint": "main",
      "repository": {
        "id": 12746310,
        "name": "sandbox",
        "full_name": "STRd6/sandbox",
        "owner": {
          "login": "STRd6",
          "id": 18894,
          "avatar_url": "https://1.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
          "gravatar_id": "33117162fff8a9cf50544a604f60c045",
          "url": "https://api.github.com/users/STRd6",
          "html_url": "https://github.com/STRd6",
          "followers_url": "https://api.github.com/users/STRd6/followers",
          "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
          "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
          "organizations_url": "https://api.github.com/users/STRd6/orgs",
          "repos_url": "https://api.github.com/users/STRd6/repos",
          "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
          "received_events_url": "https://api.github.com/users/STRd6/received_events",
          "type": "User",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/STRd6/sandbox",
        "description": "Run code in a popup window filled with sand.",
        "fork": false,
        "url": "https://api.github.com/repos/STRd6/sandbox",
        "forks_url": "https://api.github.com/repos/STRd6/sandbox/forks",
        "keys_url": "https://api.github.com/repos/STRd6/sandbox/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/STRd6/sandbox/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/STRd6/sandbox/teams",
        "hooks_url": "https://api.github.com/repos/STRd6/sandbox/hooks",
        "issue_events_url": "https://api.github.com/repos/STRd6/sandbox/issues/events{/number}",
        "events_url": "https://api.github.com/repos/STRd6/sandbox/events",
        "assignees_url": "https://api.github.com/repos/STRd6/sandbox/assignees{/user}",
        "branches_url": "https://api.github.com/repos/STRd6/sandbox/branches{/branch}",
        "tags_url": "https://api.github.com/repos/STRd6/sandbox/tags",
        "blobs_url": "https://api.github.com/repos/STRd6/sandbox/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/STRd6/sandbox/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/STRd6/sandbox/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/STRd6/sandbox/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/STRd6/sandbox/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/STRd6/sandbox/languages",
        "stargazers_url": "https://api.github.com/repos/STRd6/sandbox/stargazers",
        "contributors_url": "https://api.github.com/repos/STRd6/sandbox/contributors",
        "subscribers_url": "https://api.github.com/repos/STRd6/sandbox/subscribers",
        "subscription_url": "https://api.github.com/repos/STRd6/sandbox/subscription",
        "commits_url": "https://api.github.com/repos/STRd6/sandbox/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/STRd6/sandbox/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/STRd6/sandbox/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/STRd6/sandbox/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/STRd6/sandbox/contents/{+path}",
        "compare_url": "https://api.github.com/repos/STRd6/sandbox/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/STRd6/sandbox/merges",
        "archive_url": "https://api.github.com/repos/STRd6/sandbox/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/STRd6/sandbox/downloads",
        "issues_url": "https://api.github.com/repos/STRd6/sandbox/issues{/number}",
        "pulls_url": "https://api.github.com/repos/STRd6/sandbox/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/STRd6/sandbox/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/STRd6/sandbox/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/STRd6/sandbox/labels{/name}",
        "releases_url": "https://api.github.com/repos/STRd6/sandbox/releases{/id}",
        "created_at": "2013-09-11T03:03:50Z",
        "updated_at": "2013-10-07T19:59:04Z",
        "pushed_at": "2013-10-07T19:59:04Z",
        "git_url": "git://github.com/STRd6/sandbox.git",
        "ssh_url": "git@github.com:STRd6/sandbox.git",
        "clone_url": "https://github.com/STRd6/sandbox.git",
        "svn_url": "https://github.com/STRd6/sandbox",
        "homepage": null,
        "size": 696,
        "stargazers_count": 0,
        "watchers_count": 0,
        "language": "CoffeeScript",
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "default_branch": "master",
        "master_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "network_count": 0,
        "subscribers_count": 1,
        "branch": "v0.2.0",
        "defaultBranch": "master"
      },
      "dependencies": {},
      "name": "sandbox"
    },
    "notifications": {
      "source": {
        "LICENSE": {
          "path": "LICENSE",
          "mode": "100644",
          "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
          "type": "blob"
        },
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "notifications\n=============\n\nNotifications widget\n",
          "type": "blob"
        },
        "main.coffee.md": {
          "path": "main.coffee.md",
          "mode": "100644",
          "content": "A component to handle displaying two streams of messages: notices and errors.\n\n    Notifications = ->\n\nObservable arrays containing our notices and error streams.\n\n      notices = Observable([])\n      errors = Observable([])\n\nAn error handler capable of displaying many common errors. Still needs work.\n\n      classicError: (request, error, message) ->\n        notices []\n\n        if request.responseJSON\n          message = JSON.stringify(request.responseJSON, null, 2)\n        else\n          message ?= request\n\n        errors [message]\n\nClear all previous errors and notices and display the message as a notice.\n\n      notify: (message) ->\n        notices [message]\n        errors []\n\nAppend a message to the notices.\n\n      push: (message) ->\n        notices.push message\n\n      errors: errors\n      notices: notices\n\n      template: require('./template')\n\n    module.exports = Notifications\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "version: \"0.2.0\"\nentryPoint: \"main\"\n",
          "type": "blob"
        },
        "template.haml.md": {
          "path": "template.haml.md",
          "mode": "100644",
          "content": "A simple console to display notification streams.\n\n    .console-wrap\n      %pre.errors\n        - each @errors, (error) ->\n          = error\n      %pre.notices\n        - each @notices, (notice) ->\n          = notice\n",
          "type": "blob"
        }
      },
      "distribution": {
        "main": {
          "path": "main",
          "content": "(function() {\n  var Notifications;\n\n  Notifications = function() {\n    var errors, notices;\n    notices = Observable([]);\n    errors = Observable([]);\n    return {\n      classicError: function(request, error, message) {\n        notices([]);\n        if (request.responseJSON) {\n          message = JSON.stringify(request.responseJSON, null, 2);\n        } else {\n          if (message == null) {\n            message = request;\n          }\n        }\n        return errors([message]);\n      },\n      notify: function(message) {\n        notices([message]);\n        return errors([]);\n      },\n      push: function(message) {\n        return notices.push(message);\n      },\n      errors: errors,\n      notices: notices,\n      template: require('./template')\n    };\n  };\n\n  module.exports = Notifications;\n\n}).call(this);\n\n//# sourceURL=main.coffee",
          "type": "blob"
        },
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"version\":\"0.2.0\",\"entryPoint\":\"main\"};",
          "type": "blob"
        },
        "template": {
          "path": "template",
          "content": "module.exports = Function(\"return \" + HAMLjr.compile(\"\\n\\n.console-wrap\\n  %pre.errors\\n    - each @errors, (error) ->\\n      = error\\n  %pre.notices\\n    - each @notices, (notice) ->\\n      = notice\\n\", {compiler: CoffeeScript}))()",
          "type": "blob"
        }
      },
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "version": "0.2.0",
      "entryPoint": "main",
      "repository": {
        "id": 12908956,
        "name": "notifications",
        "full_name": "STRd6/notifications",
        "owner": {
          "login": "STRd6",
          "id": 18894,
          "avatar_url": "https://2.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
          "gravatar_id": "33117162fff8a9cf50544a604f60c045",
          "url": "https://api.github.com/users/STRd6",
          "html_url": "https://github.com/STRd6",
          "followers_url": "https://api.github.com/users/STRd6/followers",
          "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
          "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
          "organizations_url": "https://api.github.com/users/STRd6/orgs",
          "repos_url": "https://api.github.com/users/STRd6/repos",
          "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
          "received_events_url": "https://api.github.com/users/STRd6/received_events",
          "type": "User",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/STRd6/notifications",
        "description": "Notifications widget",
        "fork": false,
        "url": "https://api.github.com/repos/STRd6/notifications",
        "forks_url": "https://api.github.com/repos/STRd6/notifications/forks",
        "keys_url": "https://api.github.com/repos/STRd6/notifications/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/STRd6/notifications/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/STRd6/notifications/teams",
        "hooks_url": "https://api.github.com/repos/STRd6/notifications/hooks",
        "issue_events_url": "https://api.github.com/repos/STRd6/notifications/issues/events{/number}",
        "events_url": "https://api.github.com/repos/STRd6/notifications/events",
        "assignees_url": "https://api.github.com/repos/STRd6/notifications/assignees{/user}",
        "branches_url": "https://api.github.com/repos/STRd6/notifications/branches{/branch}",
        "tags_url": "https://api.github.com/repos/STRd6/notifications/tags",
        "blobs_url": "https://api.github.com/repos/STRd6/notifications/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/STRd6/notifications/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/STRd6/notifications/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/STRd6/notifications/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/STRd6/notifications/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/STRd6/notifications/languages",
        "stargazers_url": "https://api.github.com/repos/STRd6/notifications/stargazers",
        "contributors_url": "https://api.github.com/repos/STRd6/notifications/contributors",
        "subscribers_url": "https://api.github.com/repos/STRd6/notifications/subscribers",
        "subscription_url": "https://api.github.com/repos/STRd6/notifications/subscription",
        "commits_url": "https://api.github.com/repos/STRd6/notifications/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/STRd6/notifications/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/STRd6/notifications/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/STRd6/notifications/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/STRd6/notifications/contents/{+path}",
        "compare_url": "https://api.github.com/repos/STRd6/notifications/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/STRd6/notifications/merges",
        "archive_url": "https://api.github.com/repos/STRd6/notifications/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/STRd6/notifications/downloads",
        "issues_url": "https://api.github.com/repos/STRd6/notifications/issues{/number}",
        "pulls_url": "https://api.github.com/repos/STRd6/notifications/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/STRd6/notifications/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/STRd6/notifications/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/STRd6/notifications/labels{/name}",
        "releases_url": "https://api.github.com/repos/STRd6/notifications/releases{/id}",
        "created_at": "2013-09-17T23:04:30Z",
        "updated_at": "2013-11-03T19:32:28Z",
        "pushed_at": "2013-11-03T19:32:28Z",
        "git_url": "git://github.com/STRd6/notifications.git",
        "ssh_url": "git@github.com:STRd6/notifications.git",
        "clone_url": "https://github.com/STRd6/notifications.git",
        "svn_url": "https://github.com/STRd6/notifications",
        "homepage": null,
        "size": 652,
        "stargazers_count": 0,
        "watchers_count": 0,
        "language": null,
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "default_branch": "master",
        "master_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "network_count": 0,
        "subscribers_count": 1,
        "branch": "v0.2.0",
        "defaultBranch": "master"
      },
      "dependencies": {},
      "name": "notifications"
    },
    "md": {
      "source": {
        "LICENSE": {
          "path": "LICENSE",
          "mode": "100644",
          "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
          "type": "blob"
        },
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "md\n==\n\nGenerate documentation from from literate code files.\n",
          "type": "blob"
        },
        "languages.cson": {
          "path": "languages.cson",
          "mode": "100644",
          "content": "coffee: \"coffeescript\"\njs: \"javascript\"\n",
          "type": "blob"
        },
        "lib/highlight.js": {
          "path": "lib/highlight.js",
          "mode": "100644",
          "content": "var hljs=new function(){function l(o){return o.replace(/&/gm,\"&amp;\").replace(/</gm,\"&lt;\").replace(/>/gm,\"&gt;\")}function b(p){for(var o=p.firstChild;o;o=o.nextSibling){if(o.nodeName==\"CODE\"){return o}if(!(o.nodeType==3&&o.nodeValue.match(/\\s+/))){break}}}function h(p,o){return Array.prototype.map.call(p.childNodes,function(q){if(q.nodeType==3){return o?q.nodeValue.replace(/\\n/g,\"\"):q.nodeValue}if(q.nodeName==\"BR\"){return\"\\n\"}return h(q,o)}).join(\"\")}function a(q){var p=(q.className+\" \"+q.parentNode.className).split(/\\s+/);p=p.map(function(r){return r.replace(/^language-/,\"\")});for(var o=0;o<p.length;o++){if(e[p[o]]||p[o]==\"no-highlight\"){return p[o]}}}function c(q){var o=[];(function p(r,s){for(var t=r.firstChild;t;t=t.nextSibling){if(t.nodeType==3){s+=t.nodeValue.length}else{if(t.nodeName==\"BR\"){s+=1}else{if(t.nodeType==1){o.push({event:\"start\",offset:s,node:t});s=p(t,s);o.push({event:\"stop\",offset:s,node:t})}}}}return s})(q,0);return o}function j(x,v,w){var p=0;var y=\"\";var r=[];function t(){if(x.length&&v.length){if(x[0].offset!=v[0].offset){return(x[0].offset<v[0].offset)?x:v}else{return v[0].event==\"start\"?x:v}}else{return x.length?x:v}}function s(A){function z(B){return\" \"+B.nodeName+'=\"'+l(B.value)+'\"'}return\"<\"+A.nodeName+Array.prototype.map.call(A.attributes,z).join(\"\")+\">\"}while(x.length||v.length){var u=t().splice(0,1)[0];y+=l(w.substr(p,u.offset-p));p=u.offset;if(u.event==\"start\"){y+=s(u.node);r.push(u.node)}else{if(u.event==\"stop\"){var o,q=r.length;do{q--;o=r[q];y+=(\"</\"+o.nodeName.toLowerCase()+\">\")}while(o!=u.node);r.splice(q,1);while(q<r.length){y+=s(r[q]);q++}}}}return y+l(w.substr(p))}function f(q){function o(s,r){return RegExp(s,\"m\"+(q.cI?\"i\":\"\")+(r?\"g\":\"\"))}function p(y,w){if(y.compiled){return}y.compiled=true;var s=[];if(y.k){var r={};function z(A,t){t.split(\" \").forEach(function(B){var C=B.split(\"|\");r[C[0]]=[A,C[1]?Number(C[1]):1];s.push(C[0])})}y.lR=o(y.l||hljs.IR,true);if(typeof y.k==\"string\"){z(\"keyword\",y.k)}else{for(var x in y.k){if(!y.k.hasOwnProperty(x)){continue}z(x,y.k[x])}}y.k=r}if(w){if(y.bWK){y.b=\"\\\\b(\"+s.join(\"|\")+\")\\\\s\"}y.bR=o(y.b?y.b:\"\\\\B|\\\\b\");if(!y.e&&!y.eW){y.e=\"\\\\B|\\\\b\"}if(y.e){y.eR=o(y.e)}y.tE=y.e||\"\";if(y.eW&&w.tE){y.tE+=(y.e?\"|\":\"\")+w.tE}}if(y.i){y.iR=o(y.i)}if(y.r===undefined){y.r=1}if(!y.c){y.c=[]}for(var v=0;v<y.c.length;v++){if(y.c[v]==\"self\"){y.c[v]=y}p(y.c[v],y)}if(y.starts){p(y.starts,w)}var u=[];for(var v=0;v<y.c.length;v++){u.push(y.c[v].b)}if(y.tE){u.push(y.tE)}if(y.i){u.push(y.i)}y.t=u.length?o(u.join(\"|\"),true):{exec:function(t){return null}}}p(q)}function d(D,E){function o(r,M){for(var L=0;L<M.c.length;L++){var K=M.c[L].bR.exec(r);if(K&&K.index==0){return M.c[L]}}}function s(K,r){if(K.e&&K.eR.test(r)){return K}if(K.eW){return s(K.parent,r)}}function t(r,K){return K.i&&K.iR.test(r)}function y(L,r){var K=F.cI?r[0].toLowerCase():r[0];return L.k.hasOwnProperty(K)&&L.k[K]}function G(){var K=l(w);if(!A.k){return K}var r=\"\";var N=0;A.lR.lastIndex=0;var L=A.lR.exec(K);while(L){r+=K.substr(N,L.index-N);var M=y(A,L);if(M){v+=M[1];r+='<span class=\"'+M[0]+'\">'+L[0]+\"</span>\"}else{r+=L[0]}N=A.lR.lastIndex;L=A.lR.exec(K)}return r+K.substr(N)}function z(){if(A.sL&&!e[A.sL]){return l(w)}var r=A.sL?d(A.sL,w):g(w);if(A.r>0){v+=r.keyword_count;B+=r.r}return'<span class=\"'+r.language+'\">'+r.value+\"</span>\"}function J(){return A.sL!==undefined?z():G()}function I(L,r){var K=L.cN?'<span class=\"'+L.cN+'\">':\"\";if(L.rB){x+=K;w=\"\"}else{if(L.eB){x+=l(r)+K;w=\"\"}else{x+=K;w=r}}A=Object.create(L,{parent:{value:A}});B+=L.r}function C(K,r){w+=K;if(r===undefined){x+=J();return 0}var L=o(r,A);if(L){x+=J();I(L,r);return L.rB?0:r.length}var M=s(A,r);if(M){if(!(M.rE||M.eE)){w+=r}x+=J();do{if(A.cN){x+=\"</span>\"}A=A.parent}while(A!=M.parent);if(M.eE){x+=l(r)}w=\"\";if(M.starts){I(M.starts,\"\")}return M.rE?0:r.length}if(t(r,A)){throw\"Illegal\"}w+=r;return r.length||1}var F=e[D];f(F);var A=F;var w=\"\";var B=0;var v=0;var x=\"\";try{var u,q,p=0;while(true){A.t.lastIndex=p;u=A.t.exec(E);if(!u){break}q=C(E.substr(p,u.index-p),u[0]);p=u.index+q}C(E.substr(p));return{r:B,keyword_count:v,value:x,language:D}}catch(H){if(H==\"Illegal\"){return{r:0,keyword_count:0,value:l(E)}}else{throw H}}}function g(s){var o={keyword_count:0,r:0,value:l(s)};var q=o;for(var p in e){if(!e.hasOwnProperty(p)){continue}var r=d(p,s);r.language=p;if(r.keyword_count+r.r>q.keyword_count+q.r){q=r}if(r.keyword_count+r.r>o.keyword_count+o.r){q=o;o=r}}if(q.language){o.second_best=q}return o}function i(q,p,o){if(p){q=q.replace(/^((<[^>]+>|\\t)+)/gm,function(r,v,u,t){return v.replace(/\\t/g,p)})}if(o){q=q.replace(/\\n/g,\"<br>\")}return q}function m(r,u,p){var v=h(r,p);var t=a(r);if(t==\"no-highlight\"){return}var w=t?d(t,v):g(v);t=w.language;var o=c(r);if(o.length){var q=document.createElement(\"pre\");q.innerHTML=w.value;w.value=j(o,c(q),v)}w.value=i(w.value,u,p);var s=r.className;if(!s.match(\"(\\\\s|^)(language-)?\"+t+\"(\\\\s|$)\")){s=s?(s+\" \"+t):t}r.innerHTML=w.value;r.className=s;r.result={language:t,kw:w.keyword_count,re:w.r};if(w.second_best){r.second_best={language:w.second_best.language,kw:w.second_best.keyword_count,re:w.second_best.r}}}function n(){if(n.called){return}n.called=true;Array.prototype.map.call(document.getElementsByTagName(\"pre\"),b).filter(Boolean).forEach(function(o){m(o,hljs.tabReplace)})}function k(){window.addEventListener(\"DOMContentLoaded\",n,false);window.addEventListener(\"load\",n,false)}var e={};this.LANGUAGES=e;this.highlight=d;this.highlightAuto=g;this.fixMarkup=i;this.highlightBlock=m;this.initHighlighting=n;this.initHighlightingOnLoad=k;this.IR=\"[a-zA-Z][a-zA-Z0-9_]*\";this.UIR=\"[a-zA-Z_][a-zA-Z0-9_]*\";this.NR=\"\\\\b\\\\d+(\\\\.\\\\d+)?\";this.CNR=\"(\\\\b0[xX][a-fA-F0-9]+|(\\\\b\\\\d+(\\\\.\\\\d*)?|\\\\.\\\\d+)([eE][-+]?\\\\d+)?)\";this.BNR=\"\\\\b(0b[01]+)\";this.RSR=\"!|!=|!==|%|%=|&|&&|&=|\\\\*|\\\\*=|\\\\+|\\\\+=|,|\\\\.|-|-=|/|/=|:|;|<|<<|<<=|<=|=|==|===|>|>=|>>|>>=|>>>|>>>=|\\\\?|\\\\[|\\\\{|\\\\(|\\\\^|\\\\^=|\\\\||\\\\|=|\\\\|\\\\||~\";this.BE={b:\"\\\\\\\\[\\\\s\\\\S]\",r:0};this.ASM={cN:\"string\",b:\"'\",e:\"'\",i:\"\\\\n\",c:[this.BE],r:0};this.QSM={cN:\"string\",b:'\"',e:'\"',i:\"\\\\n\",c:[this.BE],r:0};this.CLCM={cN:\"comment\",b:\"//\",e:\"$\"};this.CBLCLM={cN:\"comment\",b:\"/\\\\*\",e:\"\\\\*/\"};this.HCM={cN:\"comment\",b:\"#\",e:\"$\"};this.NM={cN:\"number\",b:this.NR,r:0};this.CNM={cN:\"number\",b:this.CNR,r:0};this.BNM={cN:\"number\",b:this.BNR,r:0};this.inherit=function(q,r){var o={};for(var p in q){o[p]=q[p]}if(r){for(var p in r){o[p]=r[p]}}return o}}();hljs.LANGUAGES.bash=function(a){var g=\"true false\";var e=\"if then else elif fi for break continue while in do done echo exit return set declare\";var c={cN:\"variable\",b:\"\\\\$[a-zA-Z0-9_#]+\"};var b={cN:\"variable\",b:\"\\\\${([^}]|\\\\\\\\})+}\"};var h={cN:\"string\",b:'\"',e:'\"',i:\"\\\\n\",c:[a.BE,c,b],r:0};var d={cN:\"string\",b:\"'\",e:\"'\",c:[{b:\"''\"}],r:0};var f={cN:\"test_condition\",b:\"\",e:\"\",c:[h,d,c,b],k:{literal:g},r:0};return{k:{keyword:e,literal:g},c:[{cN:\"shebang\",b:\"(#!\\\\/bin\\\\/bash)|(#!\\\\/bin\\\\/sh)\",r:10},c,b,a.HCM,h,d,a.inherit(f,{b:\"\\\\[ \",e:\" \\\\]\",r:0}),a.inherit(f,{b:\"\\\\[\\\\[ \",e:\" \\\\]\\\\]\"})]}}(hljs);hljs.LANGUAGES.erlang=function(i){var c=\"[a-z'][a-zA-Z0-9_']*\";var o=\"(\"+c+\":\"+c+\"|\"+c+\")\";var f={keyword:\"after and andalso|10 band begin bnot bor bsl bzr bxor case catch cond div end fun let not of orelse|10 query receive rem try when xor\",literal:\"false true\"};var l={cN:\"comment\",b:\"%\",e:\"$\",r:0};var e={cN:\"number\",b:\"\\\\b(\\\\d+#[a-fA-F0-9]+|\\\\d+(\\\\.\\\\d+)?([eE][-+]?\\\\d+)?)\",r:0};var g={b:\"fun\\\\s+\"+c+\"/\\\\d+\"};var n={b:o+\"\\\\(\",e:\"\\\\)\",rB:true,r:0,c:[{cN:\"function_name\",b:o,r:0},{b:\"\\\\(\",e:\"\\\\)\",eW:true,rE:true,r:0}]};var h={cN:\"tuple\",b:\"{\",e:\"}\",r:0};var a={cN:\"variable\",b:\"\\\\b_([A-Z][A-Za-z0-9_]*)?\",r:0};var m={cN:\"variable\",b:\"[A-Z][a-zA-Z0-9_]*\",r:0};var b={b:\"#\",e:\"}\",i:\".\",r:0,rB:true,c:[{cN:\"record_name\",b:\"#\"+i.UIR,r:0},{b:\"{\",eW:true,r:0}]};var k={k:f,b:\"(fun|receive|if|try|case)\",e:\"end\"};k.c=[l,g,i.inherit(i.ASM,{cN:\"\"}),k,n,i.QSM,e,h,a,m,b];var j=[l,g,k,n,i.QSM,e,h,a,m,b];n.c[1].c=j;h.c=j;b.c[1].c=j;var d={cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",c:j};return{k:f,i:\"(</|\\\\*=|\\\\+=|-=|/=|/\\\\*|\\\\*/|\\\\(\\\\*|\\\\*\\\\))\",c:[{cN:\"function\",b:\"^\"+c+\"\\\\s*\\\\(\",e:\"->\",rB:true,i:\"\\\\(|#|//|/\\\\*|\\\\\\\\|:\",c:[d,{cN:\"title\",b:c}],starts:{e:\";|\\\\.\",k:f,c:j}},l,{cN:\"pp\",b:\"^-\",e:\"\\\\.\",r:0,eE:true,rB:true,l:\"-\"+i.IR,k:\"-module -record -undef -export -ifdef -ifndef -author -copyright -doc -vsn -import -include -include_lib -compile -define -else -endif -file -behaviour -behavior\",c:[d]},e,i.QSM,b,a,m,h]}}(hljs);hljs.LANGUAGES.cs=function(a){return{k:\"abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual volatile void while ascending descending from get group into join let orderby partial select set value var where yield\",c:[{cN:\"comment\",b:\"///\",e:\"$\",rB:true,c:[{cN:\"xmlDocTag\",b:\"///|<!--|-->\"},{cN:\"xmlDocTag\",b:\"</?\",e:\">\"}]},a.CLCM,a.CBLCLM,{cN:\"preprocessor\",b:\"#\",e:\"$\",k:\"if else elif endif define undef warning error line region endregion pragma checksum\"},{cN:\"string\",b:'@\"',e:'\"',c:[{b:'\"\"'}]},a.ASM,a.QSM,a.CNM]}}(hljs);hljs.LANGUAGES.brainfuck=function(a){return{c:[{cN:\"comment\",b:\"[^\\\\[\\\\]\\\\.,\\\\+\\\\-<> \\r\\n]\",eE:true,e:\"[\\\\[\\\\]\\\\.,\\\\+\\\\-<> \\r\\n]\",r:0},{cN:\"title\",b:\"[\\\\[\\\\]]\",r:0},{cN:\"string\",b:\"[\\\\.,]\"},{cN:\"literal\",b:\"[\\\\+\\\\-]\"}]}}(hljs);hljs.LANGUAGES.ruby=function(e){var a=\"[a-zA-Z_][a-zA-Z0-9_]*(\\\\!|\\\\?)?\";var j=\"[a-zA-Z_]\\\\w*[!?=]?|[-+~]\\\\@|<<|>>|=~|===?|<=>|[<>]=?|\\\\*\\\\*|[-/+%^&*~`|]|\\\\[\\\\]=?\";var g={keyword:\"and false then defined module in return redo if BEGIN retry end for true self when next until do begin unless END rescue nil else break undef not super class case require yield alias while ensure elsif or include\"};var c={cN:\"yardoctag\",b:\"@[A-Za-z]+\"};var k=[{cN:\"comment\",b:\"#\",e:\"$\",c:[c]},{cN:\"comment\",b:\"^\\\\=begin\",e:\"^\\\\=end\",c:[c],r:10},{cN:\"comment\",b:\"^__END__\",e:\"\\\\n$\"}];var d={cN:\"subst\",b:\"#\\\\{\",e:\"}\",l:a,k:g};var i=[e.BE,d];var b=[{cN:\"string\",b:\"'\",e:\"'\",c:i,r:0},{cN:\"string\",b:'\"',e:'\"',c:i,r:0},{cN:\"string\",b:\"%[qw]?\\\\(\",e:\"\\\\)\",c:i},{cN:\"string\",b:\"%[qw]?\\\\[\",e:\"\\\\]\",c:i},{cN:\"string\",b:\"%[qw]?{\",e:\"}\",c:i},{cN:\"string\",b:\"%[qw]?<\",e:\">\",c:i,r:10},{cN:\"string\",b:\"%[qw]?/\",e:\"/\",c:i,r:10},{cN:\"string\",b:\"%[qw]?%\",e:\"%\",c:i,r:10},{cN:\"string\",b:\"%[qw]?-\",e:\"-\",c:i,r:10},{cN:\"string\",b:\"%[qw]?\\\\|\",e:\"\\\\|\",c:i,r:10}];var h={cN:\"function\",bWK:true,e:\" |$|;\",k:\"def\",c:[{cN:\"title\",b:j,l:a,k:g},{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",l:a,k:g}].concat(k)};var f=k.concat(b.concat([{cN:\"class\",bWK:true,e:\"$|;\",k:\"class module\",c:[{cN:\"title\",b:\"[A-Za-z_]\\\\w*(::\\\\w+)*(\\\\?|\\\\!)?\",r:0},{cN:\"inheritance\",b:\"<\\\\s*\",c:[{cN:\"parent\",b:\"(\"+e.IR+\"::)?\"+e.IR}]}].concat(k)},h,{cN:\"constant\",b:\"(::)?(\\\\b[A-Z]\\\\w*(::)?)+\",r:0},{cN:\"symbol\",b:\":\",c:b.concat([{b:j}]),r:0},{cN:\"symbol\",b:a+\":\",r:0},{cN:\"number\",b:\"(\\\\b0[0-7_]+)|(\\\\b0x[0-9a-fA-F_]+)|(\\\\b[1-9][0-9_]*(\\\\.[0-9_]+)?)|[0_]\\\\b\",r:0},{cN:\"number\",b:\"\\\\?\\\\w\"},{cN:\"variable\",b:\"(\\\\$\\\\W)|((\\\\$|\\\\@\\\\@?)(\\\\w+))\"},{b:\"(\"+e.RSR+\")\\\\s*\",c:k.concat([{cN:\"regexp\",b:\"/\",e:\"/[a-z]*\",i:\"\\\\n\",c:[e.BE,d]}]),r:0}]));d.c=f;h.c[1].c=f;return{l:a,k:g,c:f}}(hljs);hljs.LANGUAGES.rust=function(b){var d={cN:\"title\",b:b.UIR};var c={cN:\"number\",b:\"\\\\b(0[xb][A-Za-z0-9_]+|[0-9_]+(\\\\.[0-9_]+)?([uif](8|16|32|64)?)?)\",r:0};var a=\"alt any as assert be bind block bool break char check claim const cont dir do else enum export f32 f64 fail false float fn for i16 i32 i64 i8 if iface impl import in int let log mod mutable native note of prove pure resource ret self str syntax true type u16 u32 u64 u8 uint unchecked unsafe use vec while\";return{k:a,i:\"</\",c:[b.CLCM,b.CBLCLM,b.inherit(b.QSM,{i:null}),b.ASM,c,{cN:\"function\",bWK:true,e:\"(\\\\(|<)\",k:\"fn\",c:[d]},{cN:\"preprocessor\",b:\"#\\\\[\",e:\"\\\\]\"},{bWK:true,e:\"(=|<)\",k:\"type\",c:[d],i:\"\\\\S\"},{bWK:true,e:\"({|<)\",k:\"iface enum\",c:[d],i:\"\\\\S\"}]}}(hljs);hljs.LANGUAGES.rib=function(a){return{k:\"ArchiveRecord AreaLightSource Atmosphere Attribute AttributeBegin AttributeEnd Basis Begin Blobby Bound Clipping ClippingPlane Color ColorSamples ConcatTransform Cone CoordinateSystem CoordSysTransform CropWindow Curves Cylinder DepthOfField Detail DetailRange Disk Displacement Display End ErrorHandler Exposure Exterior Format FrameAspectRatio FrameBegin FrameEnd GeneralPolygon GeometricApproximation Geometry Hider Hyperboloid Identity Illuminate Imager Interior LightSource MakeCubeFaceEnvironment MakeLatLongEnvironment MakeShadow MakeTexture Matte MotionBegin MotionEnd NuPatch ObjectBegin ObjectEnd ObjectInstance Opacity Option Orientation Paraboloid Patch PatchMesh Perspective PixelFilter PixelSamples PixelVariance Points PointsGeneralPolygons PointsPolygons Polygon Procedural Projection Quantize ReadArchive RelativeDetail ReverseOrientation Rotate Scale ScreenWindow ShadingInterpolation ShadingRate Shutter Sides Skew SolidBegin SolidEnd Sphere SubdivisionMesh Surface TextureCoordinates Torus Transform TransformBegin TransformEnd TransformPoints Translate TrimCurve WorldBegin WorldEnd\",i:\"</\",c:[a.HCM,a.CNM,a.ASM,a.QSM]}}(hljs);hljs.LANGUAGES.diff=function(a){return{c:[{cN:\"chunk\",b:\"^\\\\@\\\\@ +\\\\-\\\\d+,\\\\d+ +\\\\+\\\\d+,\\\\d+ +\\\\@\\\\@$\",r:10},{cN:\"chunk\",b:\"^\\\\*\\\\*\\\\* +\\\\d+,\\\\d+ +\\\\*\\\\*\\\\*\\\\*$\",r:10},{cN:\"chunk\",b:\"^\\\\-\\\\-\\\\- +\\\\d+,\\\\d+ +\\\\-\\\\-\\\\-\\\\-$\",r:10},{cN:\"header\",b:\"Index: \",e:\"$\"},{cN:\"header\",b:\"=====\",e:\"=====$\"},{cN:\"header\",b:\"^\\\\-\\\\-\\\\-\",e:\"$\"},{cN:\"header\",b:\"^\\\\*{3} \",e:\"$\"},{cN:\"header\",b:\"^\\\\+\\\\+\\\\+\",e:\"$\"},{cN:\"header\",b:\"\\\\*{5}\",e:\"\\\\*{5}$\"},{cN:\"addition\",b:\"^\\\\+\",e:\"$\"},{cN:\"deletion\",b:\"^\\\\-\",e:\"$\"},{cN:\"change\",b:\"^\\\\!\",e:\"$\"}]}}(hljs);hljs.LANGUAGES.javascript=function(a){return{k:{keyword:\"in if for while finally var new function do return void else break catch instanceof with throw case default try this switch continue typeof delete let yield const\",literal:\"true false null undefined NaN Infinity\"},c:[a.ASM,a.QSM,a.CLCM,a.CBLCLM,a.CNM,{b:\"(\"+a.RSR+\"|\\\\b(case|return|throw)\\\\b)\\\\s*\",k:\"return throw case\",c:[a.CLCM,a.CBLCLM,{cN:\"regexp\",b:\"/\",e:\"/[gim]*\",i:\"\\\\n\",c:[{b:\"\\\\\\\\/\"}]},{b:\"<\",e:\">;\",sL:\"xml\"}],r:0},{cN:\"function\",bWK:true,e:\"{\",k:\"function\",c:[{cN:\"title\",b:\"[A-Za-z$_][0-9A-Za-z$_]*\"},{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",c:[a.CLCM,a.CBLCLM],i:\"[\\\"'\\\\(]\"}],i:\"\\\\[|%\"}]}}(hljs);hljs.LANGUAGES.glsl=function(a){return{k:{keyword:\"atomic_uint attribute bool break bvec2 bvec3 bvec4 case centroid coherent const continue default discard dmat2 dmat2x2 dmat2x3 dmat2x4 dmat3 dmat3x2 dmat3x3 dmat3x4 dmat4 dmat4x2 dmat4x3 dmat4x4 do double dvec2 dvec3 dvec4 else flat float for highp if iimage1D iimage1DArray iimage2D iimage2DArray iimage2DMS iimage2DMSArray iimage2DRect iimage3D iimageBuffer iimageCube iimageCubeArray image1D image1DArray image2D image2DArray image2DMS image2DMSArray image2DRect image3D imageBuffer imageCube imageCubeArray in inout int invariant isampler1D isampler1DArray isampler2D isampler2DArray isampler2DMS isampler2DMSArray isampler2DRect isampler3D isamplerBuffer isamplerCube isamplerCubeArray ivec2 ivec3 ivec4 layout lowp mat2 mat2x2 mat2x3 mat2x4 mat3 mat3x2 mat3x3 mat3x4 mat4 mat4x2 mat4x3 mat4x4 mediump noperspective out patch precision readonly restrict return sample sampler1D sampler1DArray sampler1DArrayShadow sampler1DShadow sampler2D sampler2DArray sampler2DArrayShadow sampler2DMS sampler2DMSArray sampler2DRect sampler2DRectShadow sampler2DShadow sampler3D samplerBuffer samplerCube samplerCubeArray samplerCubeArrayShadow samplerCubeShadow smooth struct subroutine switch uimage1D uimage1DArray uimage2D uimage2DArray uimage2DMS uimage2DMSArray uimage2DRect uimage3D uimageBuffer uimageCube uimageCubeArray uint uniform usampler1D usampler1DArray usampler2D usampler2DArray usampler2DMS usampler2DMSArray usampler2DRect usampler3D usamplerBuffer usamplerCube usamplerCubeArray uvec2 uvec3 uvec4 varying vec2 vec3 vec4 void volatile while writeonly\",built_in:\"gl_BackColor gl_BackLightModelProduct gl_BackLightProduct gl_BackMaterial gl_BackSecondaryColor gl_ClipDistance gl_ClipPlane gl_ClipVertex gl_Color gl_DepthRange gl_EyePlaneQ gl_EyePlaneR gl_EyePlaneS gl_EyePlaneT gl_Fog gl_FogCoord gl_FogFragCoord gl_FragColor gl_FragCoord gl_FragData gl_FragDepth gl_FrontColor gl_FrontFacing gl_FrontLightModelProduct gl_FrontLightProduct gl_FrontMaterial gl_FrontSecondaryColor gl_InstanceID gl_InvocationID gl_Layer gl_LightModel gl_LightSource gl_MaxAtomicCounterBindings gl_MaxAtomicCounterBufferSize gl_MaxClipDistances gl_MaxClipPlanes gl_MaxCombinedAtomicCounterBuffers gl_MaxCombinedAtomicCounters gl_MaxCombinedImageUniforms gl_MaxCombinedImageUnitsAndFragmentOutputs gl_MaxCombinedTextureImageUnits gl_MaxDrawBuffers gl_MaxFragmentAtomicCounterBuffers gl_MaxFragmentAtomicCounters gl_MaxFragmentImageUniforms gl_MaxFragmentInputComponents gl_MaxFragmentUniformComponents gl_MaxFragmentUniformVectors gl_MaxGeometryAtomicCounterBuffers gl_MaxGeometryAtomicCounters gl_MaxGeometryImageUniforms gl_MaxGeometryInputComponents gl_MaxGeometryOutputComponents gl_MaxGeometryOutputVertices gl_MaxGeometryTextureImageUnits gl_MaxGeometryTotalOutputComponents gl_MaxGeometryUniformComponents gl_MaxGeometryVaryingComponents gl_MaxImageSamples gl_MaxImageUnits gl_MaxLights gl_MaxPatchVertices gl_MaxProgramTexelOffset gl_MaxTessControlAtomicCounterBuffers gl_MaxTessControlAtomicCounters gl_MaxTessControlImageUniforms gl_MaxTessControlInputComponents gl_MaxTessControlOutputComponents gl_MaxTessControlTextureImageUnits gl_MaxTessControlTotalOutputComponents gl_MaxTessControlUniformComponents gl_MaxTessEvaluationAtomicCounterBuffers gl_MaxTessEvaluationAtomicCounters gl_MaxTessEvaluationImageUniforms gl_MaxTessEvaluationInputComponents gl_MaxTessEvaluationOutputComponents gl_MaxTessEvaluationTextureImageUnits gl_MaxTessEvaluationUniformComponents gl_MaxTessGenLevel gl_MaxTessPatchComponents gl_MaxTextureCoords gl_MaxTextureImageUnits gl_MaxTextureUnits gl_MaxVaryingComponents gl_MaxVaryingFloats gl_MaxVaryingVectors gl_MaxVertexAtomicCounterBuffers gl_MaxVertexAtomicCounters gl_MaxVertexAttribs gl_MaxVertexImageUniforms gl_MaxVertexOutputComponents gl_MaxVertexTextureImageUnits gl_MaxVertexUniformComponents gl_MaxVertexUniformVectors gl_MaxViewports gl_MinProgramTexelOffsetgl_ModelViewMatrix gl_ModelViewMatrixInverse gl_ModelViewMatrixInverseTranspose gl_ModelViewMatrixTranspose gl_ModelViewProjectionMatrix gl_ModelViewProjectionMatrixInverse gl_ModelViewProjectionMatrixInverseTranspose gl_ModelViewProjectionMatrixTranspose gl_MultiTexCoord0 gl_MultiTexCoord1 gl_MultiTexCoord2 gl_MultiTexCoord3 gl_MultiTexCoord4 gl_MultiTexCoord5 gl_MultiTexCoord6 gl_MultiTexCoord7 gl_Normal gl_NormalMatrix gl_NormalScale gl_ObjectPlaneQ gl_ObjectPlaneR gl_ObjectPlaneS gl_ObjectPlaneT gl_PatchVerticesIn gl_PerVertex gl_Point gl_PointCoord gl_PointSize gl_Position gl_PrimitiveID gl_PrimitiveIDIn gl_ProjectionMatrix gl_ProjectionMatrixInverse gl_ProjectionMatrixInverseTranspose gl_ProjectionMatrixTranspose gl_SampleID gl_SampleMask gl_SampleMaskIn gl_SamplePosition gl_SecondaryColor gl_TessCoord gl_TessLevelInner gl_TessLevelOuter gl_TexCoord gl_TextureEnvColor gl_TextureMatrixInverseTranspose gl_TextureMatrixTranspose gl_Vertex gl_VertexID gl_ViewportIndex gl_in gl_out EmitStreamVertex EmitVertex EndPrimitive EndStreamPrimitive abs acos acosh all any asin asinh atan atanh atomicCounter atomicCounterDecrement atomicCounterIncrement barrier bitCount bitfieldExtract bitfieldInsert bitfieldReverse ceil clamp cos cosh cross dFdx dFdy degrees determinant distance dot equal exp exp2 faceforward findLSB findMSB floatBitsToInt floatBitsToUint floor fma fract frexp ftransform fwidth greaterThan greaterThanEqual imageAtomicAdd imageAtomicAnd imageAtomicCompSwap imageAtomicExchange imageAtomicMax imageAtomicMin imageAtomicOr imageAtomicXor imageLoad imageStore imulExtended intBitsToFloat interpolateAtCentroid interpolateAtOffset interpolateAtSample inverse inversesqrt isinf isnan ldexp length lessThan lessThanEqual log log2 matrixCompMult max memoryBarrier min mix mod modf noise1 noise2 noise3 noise4 normalize not notEqual outerProduct packDouble2x32 packHalf2x16 packSnorm2x16 packSnorm4x8 packUnorm2x16 packUnorm4x8 pow radians reflect refract round roundEven shadow1D shadow1DLod shadow1DProj shadow1DProjLod shadow2D shadow2DLod shadow2DProj shadow2DProjLod sign sin sinh smoothstep sqrt step tan tanh texelFetch texelFetchOffset texture texture1D texture1DLod texture1DProj texture1DProjLod texture2D texture2DLod texture2DProj texture2DProjLod texture3D texture3DLod texture3DProj texture3DProjLod textureCube textureCubeLod textureGather textureGatherOffset textureGatherOffsets textureGrad textureGradOffset textureLod textureLodOffset textureOffset textureProj textureProjGrad textureProjGradOffset textureProjLod textureProjLodOffset textureProjOffset textureQueryLod textureSize transpose trunc uaddCarry uintBitsToFloat umulExtended unpackDouble2x32 unpackHalf2x16 unpackSnorm2x16 unpackSnorm4x8 unpackUnorm2x16 unpackUnorm4x8 usubBorrow gl_TextureMatrix gl_TextureMatrixInverse\",literal:\"true false\"},i:'\"',c:[a.CLCM,a.CBLCLM,a.CNM,{cN:\"preprocessor\",b:\"#\",e:\"$\"}]}}(hljs);hljs.LANGUAGES.rsl=function(a){return{k:{keyword:\"float color point normal vector matrix while for if do return else break extern continue\",built_in:\"abs acos ambient area asin atan atmosphere attribute calculatenormal ceil cellnoise clamp comp concat cos degrees depth Deriv diffuse distance Du Dv environment exp faceforward filterstep floor format fresnel incident length lightsource log match max min mod noise normalize ntransform opposite option phong pnoise pow printf ptlined radians random reflect refract renderinfo round setcomp setxcomp setycomp setzcomp shadow sign sin smoothstep specular specularbrdf spline sqrt step tan texture textureinfo trace transform vtransform xcomp ycomp zcomp\"},i:\"</\",c:[a.CLCM,a.CBLCLM,a.QSM,a.ASM,a.CNM,{cN:\"preprocessor\",b:\"#\",e:\"$\"},{cN:\"shader\",bWK:true,e:\"\\\\(\",k:\"surface displacement light volume imager\"},{cN:\"shading\",bWK:true,e:\"\\\\(\",k:\"illuminate illuminance gather\"}]}}(hljs);hljs.LANGUAGES.lua=function(b){var a=\"\\\\[=*\\\\[\";var e=\"\\\\]=*\\\\]\";var c={b:a,e:e,c:[\"self\"]};var d=[{cN:\"comment\",b:\"--(?!\"+a+\")\",e:\"$\"},{cN:\"comment\",b:\"--\"+a,e:e,c:[c],r:10}];return{l:b.UIR,k:{keyword:\"and break do else elseif end false for if in local nil not or repeat return then true until while\",built_in:\"_G _VERSION assert collectgarbage dofile error getfenv getmetatable ipairs load loadfile loadstring module next pairs pcall print rawequal rawget rawset require select setfenv setmetatable tonumber tostring type unpack xpcall coroutine debug io math os package string table\"},c:d.concat([{cN:\"function\",bWK:true,e:\"\\\\)\",k:\"function\",c:[{cN:\"title\",b:\"([_a-zA-Z]\\\\w*\\\\.)*([_a-zA-Z]\\\\w*:)?[_a-zA-Z]\\\\w*\"},{cN:\"params\",b:\"\\\\(\",eW:true,c:d}].concat(d)},b.CNM,b.ASM,b.QSM,{cN:\"string\",b:a,e:e,c:[c],r:10}])}}(hljs);hljs.LANGUAGES.xml=function(a){var c=\"[A-Za-z0-9\\\\._:-]+\";var b={eW:true,c:[{cN:\"attribute\",b:c,r:0},{b:'=\"',rB:true,e:'\"',c:[{cN:\"value\",b:'\"',eW:true}]},{b:\"='\",rB:true,e:\"'\",c:[{cN:\"value\",b:\"'\",eW:true}]},{b:\"=\",c:[{cN:\"value\",b:\"[^\\\\s/>]+\"}]}]};return{cI:true,c:[{cN:\"pi\",b:\"<\\\\?\",e:\"\\\\?>\",r:10},{cN:\"doctype\",b:\"<!DOCTYPE\",e:\">\",r:10,c:[{b:\"\\\\[\",e:\"\\\\]\"}]},{cN:\"comment\",b:\"<!--\",e:\"-->\",r:10},{cN:\"cdata\",b:\"<\\\\!\\\\[CDATA\\\\[\",e:\"\\\\]\\\\]>\",r:10},{cN:\"tag\",b:\"<style(?=\\\\s|>|$)\",e:\">\",k:{title:\"style\"},c:[b],starts:{e:\"</style>\",rE:true,sL:\"css\"}},{cN:\"tag\",b:\"<script(?=\\\\s|>|$)\",e:\">\",k:{title:\"script\"},c:[b],starts:{e:\"<\\/script>\",rE:true,sL:\"javascript\"}},{b:\"<%\",e:\"%>\",sL:\"vbscript\"},{cN:\"tag\",b:\"</?\",e:\"/?>\",c:[{cN:\"title\",b:\"[^ />]+\"},b]}]}}(hljs);hljs.LANGUAGES.markdown=function(a){return{c:[{cN:\"header\",b:\"^#{1,3}\",e:\"$\"},{cN:\"header\",b:\"^.+?\\\\n[=-]{2,}$\"},{b:\"<\",e:\">\",sL:\"xml\",r:0},{cN:\"bullet\",b:\"^([*+-]|(\\\\d+\\\\.))\\\\s+\"},{cN:\"strong\",b:\"[*_]{2}.+?[*_]{2}\"},{cN:\"emphasis\",b:\"\\\\*.+?\\\\*\"},{cN:\"emphasis\",b:\"_.+?_\",r:0},{cN:\"blockquote\",b:\"^>\\\\s+\",e:\"$\"},{cN:\"code\",b:\"`.+?`\"},{cN:\"code\",b:\"^    \",e:\"$\",r:0},{cN:\"horizontal_rule\",b:\"^-{3,}\",e:\"$\"},{b:\"\\\\[.+?\\\\]\\\\(.+?\\\\)\",rB:true,c:[{cN:\"link_label\",b:\"\\\\[.+\\\\]\"},{cN:\"link_url\",b:\"\\\\(\",e:\"\\\\)\",eB:true,eE:true}]}]}}(hljs);hljs.LANGUAGES.css=function(a){var b={cN:\"function\",b:a.IR+\"\\\\(\",e:\"\\\\)\",c:[a.NM,a.ASM,a.QSM]};return{cI:true,i:\"[=/|']\",c:[a.CBLCLM,{cN:\"id\",b:\"\\\\#[A-Za-z0-9_-]+\"},{cN:\"class\",b:\"\\\\.[A-Za-z0-9_-]+\",r:0},{cN:\"attr_selector\",b:\"\\\\[\",e:\"\\\\]\",i:\"$\"},{cN:\"pseudo\",b:\":(:)?[a-zA-Z0-9\\\\_\\\\-\\\\+\\\\(\\\\)\\\\\\\"\\\\']+\"},{cN:\"at_rule\",b:\"@(font-face|page)\",l:\"[a-z-]+\",k:\"font-face page\"},{cN:\"at_rule\",b:\"@\",e:\"[{;]\",eE:true,k:\"import page media charset\",c:[b,a.ASM,a.QSM,a.NM]},{cN:\"tag\",b:a.IR,r:0},{cN:\"rules\",b:\"{\",e:\"}\",i:\"[^\\\\s]\",r:0,c:[a.CBLCLM,{cN:\"rule\",b:\"[^\\\\s]\",rB:true,e:\";\",eW:true,c:[{cN:\"attribute\",b:\"[A-Z\\\\_\\\\.\\\\-]+\",e:\":\",eE:true,i:\"[^\\\\s]\",starts:{cN:\"value\",eW:true,eE:true,c:[b,a.NM,a.QSM,a.ASM,a.CBLCLM,{cN:\"hexcolor\",b:\"\\\\#[0-9A-F]+\"},{cN:\"important\",b:\"!important\"}]}}]}]}]}}(hljs);hljs.LANGUAGES.lisp=function(i){var k=\"[a-zA-Z_\\\\-\\\\+\\\\*\\\\/\\\\<\\\\=\\\\>\\\\&\\\\#][a-zA-Z0-9_\\\\-\\\\+\\\\*\\\\/\\\\<\\\\=\\\\>\\\\&\\\\#]*\";var l=\"(\\\\-|\\\\+)?\\\\d+(\\\\.\\\\d+|\\\\/\\\\d+)?((d|e|f|l|s)(\\\\+|\\\\-)?\\\\d+)?\";var a={cN:\"literal\",b:\"\\\\b(t{1}|nil)\\\\b\"};var d=[{cN:\"number\",b:l},{cN:\"number\",b:\"#b[0-1]+(/[0-1]+)?\"},{cN:\"number\",b:\"#o[0-7]+(/[0-7]+)?\"},{cN:\"number\",b:\"#x[0-9a-f]+(/[0-9a-f]+)?\"},{cN:\"number\",b:\"#c\\\\(\"+l+\" +\"+l,e:\"\\\\)\"}];var h={cN:\"string\",b:'\"',e:'\"',c:[i.BE],r:0};var m={cN:\"comment\",b:\";\",e:\"$\"};var g={cN:\"variable\",b:\"\\\\*\",e:\"\\\\*\"};var n={cN:\"keyword\",b:\"[:&]\"+k};var b={b:\"\\\\(\",e:\"\\\\)\",c:[\"self\",a,h].concat(d)};var e={cN:\"quoted\",b:\"['`]\\\\(\",e:\"\\\\)\",c:d.concat([h,g,n,b])};var c={cN:\"quoted\",b:\"\\\\(quote \",e:\"\\\\)\",k:{title:\"quote\"},c:d.concat([h,g,n,b])};var j={cN:\"list\",b:\"\\\\(\",e:\"\\\\)\"};var f={cN:\"body\",eW:true,eE:true};j.c=[{cN:\"title\",b:k},f];f.c=[e,c,j,a].concat(d).concat([h,m,g,n]);return{i:\"[^\\\\s]\",c:d.concat([a,h,m,e,c,j])}}(hljs);hljs.LANGUAGES.profile=function(a){return{c:[a.CNM,{cN:\"builtin\",b:\"{\",e:\"}$\",eB:true,eE:true,c:[a.ASM,a.QSM],r:0},{cN:\"filename\",b:\"[a-zA-Z_][\\\\da-zA-Z_]+\\\\.[\\\\da-zA-Z_]{1,3}\",e:\":\",eE:true},{cN:\"header\",b:\"(ncalls|tottime|cumtime)\",e:\"$\",k:\"ncalls tottime|10 cumtime|10 filename\",r:10},{cN:\"summary\",b:\"function calls\",e:\"$\",c:[a.CNM],r:10},a.ASM,a.QSM,{cN:\"function\",b:\"\\\\(\",e:\"\\\\)$\",c:[{cN:\"title\",b:a.UIR,r:0}],r:0}]}}(hljs);hljs.LANGUAGES.http=function(a){return{i:\"\\\\S\",c:[{cN:\"status\",b:\"^HTTP/[0-9\\\\.]+\",e:\"$\",c:[{cN:\"number\",b:\"\\\\b\\\\d{3}\\\\b\"}]},{cN:\"request\",b:\"^[A-Z]+ (.*?) HTTP/[0-9\\\\.]+$\",rB:true,e:\"$\",c:[{cN:\"string\",b:\" \",e:\" \",eB:true,eE:true}]},{cN:\"attribute\",b:\"^\\\\w\",e:\": \",eE:true,i:\"\\\\n|\\\\s|=\",starts:{cN:\"string\",e:\"$\"}},{b:\"\\\\n\\\\n\",starts:{sL:\"\",eW:true}}]}}(hljs);hljs.LANGUAGES.java=function(a){return{k:\"false synchronized int abstract float private char boolean static null if const for true while long throw strictfp finally protected import native final return void enum else break transient new catch instanceof byte super volatile case assert short package default double public try this switch continue throws\",c:[{cN:\"javadoc\",b:\"/\\\\*\\\\*\",e:\"\\\\*/\",c:[{cN:\"javadoctag\",b:\"@[A-Za-z]+\"}],r:10},a.CLCM,a.CBLCLM,a.ASM,a.QSM,{cN:\"class\",bWK:true,e:\"{\",k:\"class interface\",i:\":\",c:[{bWK:true,k:\"extends implements\",r:10},{cN:\"title\",b:a.UIR}]},a.CNM,{cN:\"annotation\",b:\"@[A-Za-z]+\"}]}}(hljs);hljs.LANGUAGES.php=function(a){var e={cN:\"variable\",b:\"\\\\$+[a-zA-Z_\\x7f-\\xff][a-zA-Z0-9_\\x7f-\\xff]*\"};var b=[a.inherit(a.ASM,{i:null}),a.inherit(a.QSM,{i:null}),{cN:\"string\",b:'b\"',e:'\"',c:[a.BE]},{cN:\"string\",b:\"b'\",e:\"'\",c:[a.BE]}];var c=[a.BNM,a.CNM];var d={cN:\"title\",b:a.UIR};return{cI:true,k:\"and include_once list abstract global private echo interface as static endswitch array null if endwhile or const for endforeach self var while isset public protected exit foreach throw elseif include __FILE__ empty require_once do xor return implements parent clone use __CLASS__ __LINE__ else break print eval new catch __METHOD__ case exception php_user_filter default die require __FUNCTION__ enddeclare final try this switch continue endfor endif declare unset true false namespace trait goto instanceof insteadof __DIR__ __NAMESPACE__ __halt_compiler\",c:[a.CLCM,a.HCM,{cN:\"comment\",b:\"/\\\\*\",e:\"\\\\*/\",c:[{cN:\"phpdoc\",b:\"\\\\s@[A-Za-z]+\"}]},{cN:\"comment\",eB:true,b:\"__halt_compiler.+?;\",eW:true},{cN:\"string\",b:\"<<<['\\\"]?\\\\w+['\\\"]?$\",e:\"^\\\\w+;\",c:[a.BE]},{cN:\"preprocessor\",b:\"<\\\\?php\",r:10},{cN:\"preprocessor\",b:\"\\\\?>\"},e,{cN:\"function\",bWK:true,e:\"{\",k:\"function\",i:\"\\\\$|\\\\[|%\",c:[d,{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",c:[\"self\",e,a.CBLCLM].concat(b).concat(c)}]},{cN:\"class\",bWK:true,e:\"{\",k:\"class\",i:\"[:\\\\(\\\\$]\",c:[{bWK:true,eW:true,k:\"extends\",c:[d]},d]},{b:\"=>\"}].concat(b).concat(c)}}(hljs);hljs.LANGUAGES.haskell=function(a){var d={cN:\"type\",b:\"\\\\b[A-Z][\\\\w']*\",r:0};var c={cN:\"container\",b:\"\\\\(\",e:\"\\\\)\",c:[{cN:\"type\",b:\"\\\\b[A-Z][\\\\w]*(\\\\((\\\\.\\\\.|,|\\\\w+)\\\\))?\"},{cN:\"title\",b:\"[_a-z][\\\\w']*\"}]};var b={cN:\"container\",b:\"{\",e:\"}\",c:c.c};return{k:\"let in if then else case of where do module import hiding qualified type data newtype deriving class instance not as foreign ccall safe unsafe\",c:[{cN:\"comment\",b:\"--\",e:\"$\"},{cN:\"preprocessor\",b:\"{-#\",e:\"#-}\"},{cN:\"comment\",c:[\"self\"],b:\"{-\",e:\"-}\"},{cN:\"string\",b:\"\\\\s+'\",e:\"'\",c:[a.BE],r:0},a.QSM,{cN:\"import\",b:\"\\\\bimport\",e:\"$\",k:\"import qualified as hiding\",c:[c],i:\"\\\\W\\\\.|;\"},{cN:\"module\",b:\"\\\\bmodule\",e:\"where\",k:\"module where\",c:[c],i:\"\\\\W\\\\.|;\"},{cN:\"class\",b:\"\\\\b(class|instance)\",e:\"where\",k:\"class where instance\",c:[d]},{cN:\"typedef\",b:\"\\\\b(data|(new)?type)\",e:\"$\",k:\"data type newtype deriving\",c:[d,c,b]},a.CNM,{cN:\"shebang\",b:\"#!\\\\/usr\\\\/bin\\\\/env runhaskell\",e:\"$\"},d,{cN:\"title\",b:\"^[_a-z][\\\\w']*\"}]}}(hljs);hljs.LANGUAGES[\"1c\"]=function(b){var f=\"[a-zA-ZÐ°-ÑÐ-Ð¯][a-zA-Z0-9_Ð°-ÑÐ-Ð¯]*\";var c=\"Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‚ Ð´Ð°Ñ‚Ð° Ð´Ð»Ñ ÐµÑÐ»Ð¸ Ð¸ Ð¸Ð»Ð¸ Ð¸Ð½Ð°Ñ‡Ðµ Ð¸Ð½Ð°Ñ‡ÐµÐµÑÐ»Ð¸ Ð¸ÑÐºÐ»ÑŽÑ‡ÐµÐ½Ð¸Ðµ ÐºÐ¾Ð½ÐµÑ†ÐµÑÐ»Ð¸ ÐºÐ¾Ð½ÐµÑ†Ð¿Ð¾Ð¿Ñ‹Ñ‚ÐºÐ¸ ÐºÐ¾Ð½ÐµÑ†Ð¿Ñ€Ð¾Ñ†ÐµÐ´ÑƒÑ€Ñ‹ ÐºÐ¾Ð½ÐµÑ†Ñ„ÑƒÐ½ÐºÑ†Ð¸Ð¸ ÐºÐ¾Ð½ÐµÑ†Ñ†Ð¸ÐºÐ»Ð° ÐºÐ¾Ð½ÑÑ‚Ð°Ð½Ñ‚Ð° Ð½Ðµ Ð¿ÐµÑ€ÐµÐ¹Ñ‚Ð¸ Ð¿ÐµÑ€ÐµÐ¼ Ð¿ÐµÑ€ÐµÑ‡Ð¸ÑÐ»ÐµÐ½Ð¸Ðµ Ð¿Ð¾ Ð¿Ð¾ÐºÐ° Ð¿Ð¾Ð¿Ñ‹Ñ‚ÐºÐ° Ð¿Ñ€ÐµÑ€Ð²Ð°Ñ‚ÑŒ Ð¿Ñ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚ÑŒ Ð¿Ñ€Ð¾Ñ†ÐµÐ´ÑƒÑ€Ð° ÑÑ‚Ñ€Ð¾ÐºÐ° Ñ‚Ð¾Ð³Ð´Ð° Ñ„Ñ Ñ„ÑƒÐ½ÐºÑ†Ð¸Ñ Ñ†Ð¸ÐºÐ» Ñ‡Ð¸ÑÐ»Ð¾ ÑÐºÑÐ¿Ð¾Ñ€Ñ‚\";var e=\"ansitooem oemtoansi Ð²Ð²ÐµÑÑ‚Ð¸Ð²Ð¸Ð´ÑÑƒÐ±ÐºÐ¾Ð½Ñ‚Ð¾ Ð²Ð²ÐµÑÑ‚Ð¸Ð´Ð°Ñ‚Ñƒ Ð²Ð²ÐµÑÑ‚Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ Ð²Ð²ÐµÑÑ‚Ð¸Ð¿ÐµÑ€ÐµÑ‡Ð¸ÑÐ»ÐµÐ½Ð¸Ðµ Ð²Ð²ÐµÑÑ‚Ð¸Ð¿ÐµÑ€Ð¸Ð¾Ð´ Ð²Ð²ÐµÑÑ‚Ð¸Ð¿Ð»Ð°Ð½ÑÑ‡ÐµÑ‚Ð¾Ð² Ð²Ð²ÐµÑÑ‚Ð¸ÑÑ‚Ñ€Ð¾ÐºÑƒ Ð²Ð²ÐµÑÑ‚Ð¸Ñ‡Ð¸ÑÐ»Ð¾ Ð²Ð¾Ð¿Ñ€Ð¾Ñ Ð²Ð¾ÑÑÑ‚Ð°Ð½Ð¾Ð²Ð¸Ñ‚ÑŒÐ·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ Ð²Ñ€ÐµÐ³ Ð²Ñ‹Ð±Ñ€Ð°Ð½Ð½Ñ‹Ð¹Ð¿Ð»Ð°Ð½ÑÑ‡ÐµÑ‚Ð¾Ð² Ð²Ñ‹Ð·Ð²Ð°Ñ‚ÑŒÐ¸ÑÐºÐ»ÑŽÑ‡ÐµÐ½Ð¸Ðµ Ð´Ð°Ñ‚Ð°Ð³Ð¾Ð´ Ð´Ð°Ñ‚Ð°Ð¼ÐµÑÑÑ† Ð´Ð°Ñ‚Ð°Ñ‡Ð¸ÑÐ»Ð¾ Ð´Ð¾Ð±Ð°Ð²Ð¸Ñ‚ÑŒÐ¼ÐµÑÑÑ† Ð·Ð°Ð²ÐµÑ€ÑˆÐ¸Ñ‚ÑŒÑ€Ð°Ð±Ð¾Ñ‚ÑƒÑÐ¸ÑÑ‚ÐµÐ¼Ñ‹ Ð·Ð°Ð³Ð¾Ð»Ð¾Ð²Ð¾ÐºÑÐ¸ÑÑ‚ÐµÐ¼Ñ‹ Ð·Ð°Ð¿Ð¸ÑÑŒÐ¶ÑƒÑ€Ð½Ð°Ð»Ð°Ñ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ð°Ñ†Ð¸Ð¸ Ð·Ð°Ð¿ÑƒÑÑ‚Ð¸Ñ‚ÑŒÐ¿Ñ€Ð¸Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ Ð·Ð°Ñ„Ð¸ÐºÑÐ¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒÑ‚Ñ€Ð°Ð½Ð·Ð°ÐºÑ†Ð¸ÑŽ Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÐµÐ²ÑÑ‚Ñ€Ð¾ÐºÑƒ Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÐµÐ²ÑÑ‚Ñ€Ð¾ÐºÑƒÐ²Ð½ÑƒÑ‚Ñ€ Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÐµÐ²Ñ„Ð°Ð¹Ð» Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÐµÐ¸Ð·ÑÑ‚Ñ€Ð¾ÐºÐ¸ Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÐµÐ¸Ð·ÑÑ‚Ñ€Ð¾ÐºÐ¸Ð²Ð½ÑƒÑ‚Ñ€ Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÐµÐ¸Ð·Ñ„Ð°Ð¹Ð»Ð° Ð¸Ð¼ÑÐºÐ¾Ð¼Ð¿ÑŒÑŽÑ‚ÐµÑ€Ð° Ð¸Ð¼ÑÐ¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ ÐºÐ°Ñ‚Ð°Ð»Ð¾Ð³Ð²Ñ€ÐµÐ¼ÐµÐ½Ð½Ñ‹Ñ…Ñ„Ð°Ð¹Ð»Ð¾Ð² ÐºÐ°Ñ‚Ð°Ð»Ð¾Ð³Ð¸Ð± ÐºÐ°Ñ‚Ð°Ð»Ð¾Ð³Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ ÐºÐ°Ñ‚Ð°Ð»Ð¾Ð³Ð¿Ñ€Ð¾Ð³Ñ€Ð°Ð¼Ð¼Ñ‹ ÐºÐ¾Ð´ÑÐ¸Ð¼Ð² ÐºÐ¾Ð¼Ð°Ð½Ð´Ð°ÑÐ¸ÑÑ‚ÐµÐ¼Ñ‹ ÐºÐ¾Ð½Ð³Ð¾Ð´Ð° ÐºÐ¾Ð½ÐµÑ†Ð¿ÐµÑ€Ð¸Ð¾Ð´Ð°Ð±Ð¸ ÐºÐ¾Ð½ÐµÑ†Ñ€Ð°ÑÑÑ‡Ð¸Ñ‚Ð°Ð½Ð½Ð¾Ð³Ð¾Ð¿ÐµÑ€Ð¸Ð¾Ð´Ð°Ð±Ð¸ ÐºÐ¾Ð½ÐµÑ†ÑÑ‚Ð°Ð½Ð´Ð°Ñ€Ñ‚Ð½Ð¾Ð³Ð¾Ð¸Ð½Ñ‚ÐµÑ€Ð²Ð°Ð»Ð° ÐºÐ¾Ð½ÐºÐ²Ð°Ñ€Ñ‚Ð°Ð»Ð° ÐºÐ¾Ð½Ð¼ÐµÑÑÑ†Ð° ÐºÐ¾Ð½Ð½ÐµÐ´ÐµÐ»Ð¸ Ð»ÐµÐ² Ð»Ð¾Ð³ Ð»Ð¾Ð³10 Ð¼Ð°ÐºÑ Ð¼Ð°ÐºÑÐ¸Ð¼Ð°Ð»ÑŒÐ½Ð¾ÐµÐºÐ¾Ð»Ð¸Ñ‡ÐµÑÑ‚Ð²Ð¾ÑÑƒÐ±ÐºÐ¾Ð½Ñ‚Ð¾ Ð¼Ð¸Ð½ Ð¼Ð¾Ð½Ð¾Ð¿Ð¾Ð»ÑŒÐ½Ñ‹Ð¹Ñ€ÐµÐ¶Ð¸Ð¼ Ð½Ð°Ð·Ð²Ð°Ð½Ð¸ÐµÐ¸Ð½Ñ‚ÐµÑ€Ñ„ÐµÐ¹ÑÐ° Ð½Ð°Ð·Ð²Ð°Ð½Ð¸ÐµÐ½Ð°Ð±Ð¾Ñ€Ð°Ð¿Ñ€Ð°Ð² Ð½Ð°Ð·Ð½Ð°Ñ‡Ð¸Ñ‚ÑŒÐ²Ð¸Ð´ Ð½Ð°Ð·Ð½Ð°Ñ‡Ð¸Ñ‚ÑŒÑÑ‡ÐµÑ‚ Ð½Ð°Ð¹Ñ‚Ð¸ Ð½Ð°Ð¹Ñ‚Ð¸Ð¿Ð¾Ð¼ÐµÑ‡ÐµÐ½Ð½Ñ‹ÐµÐ½Ð°ÑƒÐ´Ð°Ð»ÐµÐ½Ð¸Ðµ Ð½Ð°Ð¹Ñ‚Ð¸ÑÑÑ‹Ð»ÐºÐ¸ Ð½Ð°Ñ‡Ð°Ð»Ð¾Ð¿ÐµÑ€Ð¸Ð¾Ð´Ð°Ð±Ð¸ Ð½Ð°Ñ‡Ð°Ð»Ð¾ÑÑ‚Ð°Ð½Ð´Ð°Ñ€Ñ‚Ð½Ð¾Ð³Ð¾Ð¸Ð½Ñ‚ÐµÑ€Ð²Ð°Ð»Ð° Ð½Ð°Ñ‡Ð°Ñ‚ÑŒÑ‚Ñ€Ð°Ð½Ð·Ð°ÐºÑ†Ð¸ÑŽ Ð½Ð°Ñ‡Ð³Ð¾Ð´Ð° Ð½Ð°Ñ‡ÐºÐ²Ð°Ñ€Ñ‚Ð°Ð»Ð° Ð½Ð°Ñ‡Ð¼ÐµÑÑÑ†Ð° Ð½Ð°Ñ‡Ð½ÐµÐ´ÐµÐ»Ð¸ Ð½Ð¾Ð¼ÐµÑ€Ð´Ð½ÑÐ³Ð¾Ð´Ð° Ð½Ð¾Ð¼ÐµÑ€Ð´Ð½ÑÐ½ÐµÐ´ÐµÐ»Ð¸ Ð½Ð¾Ð¼ÐµÑ€Ð½ÐµÐ´ÐµÐ»Ð¸Ð³Ð¾Ð´Ð° Ð½Ñ€ÐµÐ³ Ð¾Ð±Ñ€Ð°Ð±Ð¾Ñ‚ÐºÐ°Ð¾Ð¶Ð¸Ð´Ð°Ð½Ð¸Ñ Ð¾ÐºÑ€ Ð¾Ð¿Ð¸ÑÐ°Ð½Ð¸ÐµÐ¾ÑˆÐ¸Ð±ÐºÐ¸ Ð¾ÑÐ½Ð¾Ð²Ð½Ð¾Ð¹Ð¶ÑƒÑ€Ð½Ð°Ð»Ñ€Ð°ÑÑ‡ÐµÑ‚Ð¾Ð² Ð¾ÑÐ½Ð¾Ð²Ð½Ð¾Ð¹Ð¿Ð»Ð°Ð½ÑÑ‡ÐµÑ‚Ð¾Ð² Ð¾ÑÐ½Ð¾Ð²Ð½Ð¾Ð¹ÑÐ·Ñ‹Ðº Ð¾Ñ‚ÐºÑ€Ñ‹Ñ‚ÑŒÑ„Ð¾Ñ€Ð¼Ñƒ Ð¾Ñ‚ÐºÑ€Ñ‹Ñ‚ÑŒÑ„Ð¾Ñ€Ð¼ÑƒÐ¼Ð¾Ð´Ð°Ð»ÑŒÐ½Ð¾ Ð¾Ñ‚Ð¼ÐµÐ½Ð¸Ñ‚ÑŒÑ‚Ñ€Ð°Ð½Ð·Ð°ÐºÑ†Ð¸ÑŽ Ð¾Ñ‡Ð¸ÑÑ‚Ð¸Ñ‚ÑŒÐ¾ÐºÐ½Ð¾ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹ Ð¿ÐµÑ€Ð¸Ð¾Ð´ÑÑ‚Ñ€ Ð¿Ð¾Ð»Ð½Ð¾ÐµÐ¸Ð¼ÑÐ¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÐ²Ñ€ÐµÐ¼ÑÑ‚Ð° Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÐ´Ð°Ñ‚ÑƒÑ‚Ð° Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÐ´Ð¾ÐºÑƒÐ¼ÐµÐ½Ñ‚Ñ‚Ð° Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÐ·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÑÐ¾Ñ‚Ð±Ð¾Ñ€Ð° Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÐ¿Ð¾Ð·Ð¸Ñ†Ð¸ÑŽÑ‚Ð° Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÐ¿ÑƒÑÑ‚Ð¾ÐµÐ·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÑ‚Ð° Ð¿Ñ€Ð°Ð² Ð¿Ñ€Ð°Ð²Ð¾Ð´Ð¾ÑÑ‚ÑƒÐ¿Ð° Ð¿Ñ€ÐµÐ´ÑƒÐ¿Ñ€ÐµÐ¶Ð´ÐµÐ½Ð¸Ðµ Ð¿Ñ€ÐµÑ„Ð¸ÐºÑÐ°Ð²Ñ‚Ð¾Ð½ÑƒÐ¼ÐµÑ€Ð°Ñ†Ð¸Ð¸ Ð¿ÑƒÑÑ‚Ð°ÑÑÑ‚Ñ€Ð¾ÐºÐ° Ð¿ÑƒÑÑ‚Ð¾ÐµÐ·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ Ñ€Ð°Ð±Ð¾Ñ‡Ð°ÑÐ´Ð°Ñ‚Ñ‚ÑŒÐ¿ÑƒÑÑ‚Ð¾ÐµÐ·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ Ñ€Ð°Ð±Ð¾Ñ‡Ð°ÑÐ´Ð°Ñ‚Ð° Ñ€Ð°Ð·Ð´ÐµÐ»Ð¸Ñ‚ÐµÐ»ÑŒÑÑ‚Ñ€Ð°Ð½Ð¸Ñ† Ñ€Ð°Ð·Ð´ÐµÐ»Ð¸Ñ‚ÐµÐ»ÑŒÑÑ‚Ñ€Ð¾Ðº Ñ€Ð°Ð·Ð¼ Ñ€Ð°Ð·Ð¾Ð±Ñ€Ð°Ñ‚ÑŒÐ¿Ð¾Ð·Ð¸Ñ†Ð¸ÑŽÐ´Ð¾ÐºÑƒÐ¼ÐµÐ½Ñ‚Ð° Ñ€Ð°ÑÑÑ‡Ð¸Ñ‚Ð°Ñ‚ÑŒÑ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ñ‹Ð½Ð° Ñ€Ð°ÑÑÑ‡Ð¸Ñ‚Ð°Ñ‚ÑŒÑ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ñ‹Ð¿Ð¾ ÑÐ¸Ð³Ð½Ð°Ð» ÑÐ¸Ð¼Ð² ÑÐ¸Ð¼Ð²Ð¾Ð»Ñ‚Ð°Ð±ÑƒÐ»ÑÑ†Ð¸Ð¸ ÑÐ¾Ð·Ð´Ð°Ñ‚ÑŒÐ¾Ð±ÑŠÐµÐºÑ‚ ÑÐ¾ÐºÑ€Ð» ÑÐ¾ÐºÑ€Ð»Ð¿ ÑÐ¾ÐºÑ€Ð¿ ÑÐ¾Ð¾Ð±Ñ‰Ð¸Ñ‚ÑŒ ÑÐ¾ÑÑ‚Ð¾ÑÐ½Ð¸Ðµ ÑÐ¾Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑŒÐ·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ ÑÑ€ÐµÐ´ ÑÑ‚Ð°Ñ‚ÑƒÑÐ²Ð¾Ð·Ð²Ñ€Ð°Ñ‚Ð° ÑÑ‚Ñ€Ð´Ð»Ð¸Ð½Ð° ÑÑ‚Ñ€Ð·Ð°Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ ÑÑ‚Ñ€ÐºÐ¾Ð»Ð¸Ñ‡ÐµÑÑ‚Ð²Ð¾ÑÑ‚Ñ€Ð¾Ðº ÑÑ‚Ñ€Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÑÑ‚Ñ€Ð¾ÐºÑƒ  ÑÑ‚Ñ€Ñ‡Ð¸ÑÐ»Ð¾Ð²Ñ…Ð¾Ð¶Ð´ÐµÐ½Ð¸Ð¹ ÑÑ„Ð¾Ñ€Ð¼Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒÐ¿Ð¾Ð·Ð¸Ñ†Ð¸ÑŽÐ´Ð¾ÐºÑƒÐ¼ÐµÐ½Ñ‚Ð° ÑÑ‡ÐµÑ‚Ð¿Ð¾ÐºÐ¾Ð´Ñƒ Ñ‚ÐµÐºÑƒÑ‰Ð°ÑÐ´Ð°Ñ‚Ð° Ñ‚ÐµÐºÑƒÑ‰ÐµÐµÐ²Ñ€ÐµÐ¼Ñ Ñ‚Ð¸Ð¿Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ Ñ‚Ð¸Ð¿Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÑÑÑ‚Ñ€ ÑƒÐ´Ð°Ð»Ð¸Ñ‚ÑŒÐ¾Ð±ÑŠÐµÐºÑ‚Ñ‹ ÑƒÑÑ‚Ð°Ð½Ð¾Ð²Ð¸Ñ‚ÑŒÑ‚Ð°Ð½Ð° ÑƒÑÑ‚Ð°Ð½Ð¾Ð²Ð¸Ñ‚ÑŒÑ‚Ð°Ð¿Ð¾ Ñ„Ð¸ÐºÑÑˆÐ°Ð±Ð»Ð¾Ð½ Ñ„Ð¾Ñ€Ð¼Ð°Ñ‚ Ñ†ÐµÐ» ÑˆÐ°Ð±Ð»Ð¾Ð½\";var a={cN:\"dquote\",b:'\"\"'};var d={cN:\"string\",b:'\"',e:'\"|$',c:[a],r:0};var g={cN:\"string\",b:\"\\\\|\",e:'\"|$',c:[a]};return{cI:true,l:f,k:{keyword:c,built_in:e},c:[b.CLCM,b.NM,d,g,{cN:\"function\",b:\"(Ð¿Ñ€Ð¾Ñ†ÐµÐ´ÑƒÑ€Ð°|Ñ„ÑƒÐ½ÐºÑ†Ð¸Ñ)\",e:\"$\",l:f,k:\"Ð¿Ñ€Ð¾Ñ†ÐµÐ´ÑƒÑ€Ð° Ñ„ÑƒÐ½ÐºÑ†Ð¸Ñ\",c:[{cN:\"title\",b:f},{cN:\"tail\",eW:true,c:[{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",l:f,k:\"Ð·Ð½Ð°Ñ‡\",c:[d,g]},{cN:\"export\",b:\"ÑÐºÑÐ¿Ð¾Ñ€Ñ‚\",eW:true,l:f,k:\"ÑÐºÑÐ¿Ð¾Ñ€Ñ‚\",c:[b.CLCM]}]},b.CLCM]},{cN:\"preprocessor\",b:\"#\",e:\"$\"},{cN:\"date\",b:\"'\\\\d{2}\\\\.\\\\d{2}\\\\.(\\\\d{2}|\\\\d{4})'\"}]}}(hljs);hljs.LANGUAGES.python=function(a){var f={cN:\"prompt\",b:\"^(>>>|\\\\.\\\\.\\\\.) \"};var c=[{cN:\"string\",b:\"(u|b)?r?'''\",e:\"'''\",c:[f],r:10},{cN:\"string\",b:'(u|b)?r?\"\"\"',e:'\"\"\"',c:[f],r:10},{cN:\"string\",b:\"(u|r|ur)'\",e:\"'\",c:[a.BE],r:10},{cN:\"string\",b:'(u|r|ur)\"',e:'\"',c:[a.BE],r:10},{cN:\"string\",b:\"(b|br)'\",e:\"'\",c:[a.BE]},{cN:\"string\",b:'(b|br)\"',e:'\"',c:[a.BE]}].concat([a.ASM,a.QSM]);var e={cN:\"title\",b:a.UIR};var d={cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",c:[\"self\",a.CNM,f].concat(c)};var b={bWK:true,e:\":\",i:\"[${=;\\\\n]\",c:[e,d],r:10};return{k:{keyword:\"and elif is global as in if from raise for except finally print import pass return exec else break not with class assert yield try while continue del or def lambda nonlocal|10\",built_in:\"None True False Ellipsis NotImplemented\"},i:\"(</|->|\\\\?)\",c:c.concat([f,a.HCM,a.inherit(b,{cN:\"function\",k:\"def\"}),a.inherit(b,{cN:\"class\",k:\"class\"}),a.CNM,{cN:\"decorator\",b:\"@\",e:\"$\"},{b:\"\\\\b(print|exec)\\\\(\"}])}}(hljs);hljs.LANGUAGES.smalltalk=function(a){var b=\"[a-z][a-zA-Z0-9_]*\";var d={cN:\"char\",b:\"\\\\$.{1}\"};var c={cN:\"symbol\",b:\"#\"+a.UIR};return{k:\"self super nil true false thisContext\",c:[{cN:\"comment\",b:'\"',e:'\"',r:0},a.ASM,{cN:\"class\",b:\"\\\\b[A-Z][A-Za-z0-9_]*\",r:0},{cN:\"method\",b:b+\":\"},a.CNM,c,d,{cN:\"localvars\",b:\"\\\\|\\\\s*((\"+b+\")\\\\s*)+\\\\|\"},{cN:\"array\",b:\"\\\\#\\\\(\",e:\"\\\\)\",c:[a.ASM,d,a.CNM,c]}]}}(hljs);hljs.LANGUAGES.tex=function(a){var d={cN:\"command\",b:\"\\\\\\\\[a-zA-ZÐ°-ÑÐ-Ñ]+[\\\\*]?\"};var c={cN:\"command\",b:\"\\\\\\\\[^a-zA-ZÐ°-ÑÐ-Ñ0-9]\"};var b={cN:\"special\",b:\"[{}\\\\[\\\\]\\\\&#~]\",r:0};return{c:[{b:\"\\\\\\\\[a-zA-ZÐ°-ÑÐ-Ñ]+[\\\\*]? *= *-?\\\\d*\\\\.?\\\\d+(pt|pc|mm|cm|in|dd|cc|ex|em)?\",rB:true,c:[d,c,{cN:\"number\",b:\" *=\",e:\"-?\\\\d*\\\\.?\\\\d+(pt|pc|mm|cm|in|dd|cc|ex|em)?\",eB:true}],r:10},d,c,b,{cN:\"formula\",b:\"\\\\$\\\\$\",e:\"\\\\$\\\\$\",c:[d,c,b],r:0},{cN:\"formula\",b:\"\\\\$\",e:\"\\\\$\",c:[d,c,b],r:0},{cN:\"comment\",b:\"%\",e:\"$\",r:0}]}}(hljs);hljs.LANGUAGES.actionscript=function(a){var d=\"[a-zA-Z_$][a-zA-Z0-9_$]*\";var c=\"([*]|[a-zA-Z_$][a-zA-Z0-9_$]*)\";var e={cN:\"rest_arg\",b:\"[.]{3}\",e:d,r:10};var b={cN:\"title\",b:d};return{k:{keyword:\"as break case catch class const continue default delete do dynamic each else extends final finally for function get if implements import in include instanceof interface internal is namespace native new override package private protected public return set static super switch this throw try typeof use var void while with\",literal:\"true false null undefined\"},c:[a.ASM,a.QSM,a.CLCM,a.CBLCLM,a.CNM,{cN:\"package\",bWK:true,e:\"{\",k:\"package\",c:[b]},{cN:\"class\",bWK:true,e:\"{\",k:\"class interface\",c:[{bWK:true,k:\"extends implements\"},b]},{cN:\"preprocessor\",bWK:true,e:\";\",k:\"import include\"},{cN:\"function\",bWK:true,e:\"[{;]\",k:\"function\",i:\"\\\\S\",c:[b,{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",c:[a.ASM,a.QSM,a.CLCM,a.CBLCLM,e]},{cN:\"type\",b:\":\",e:c,r:10}]}]}}(hljs);hljs.LANGUAGES.sql=function(a){return{cI:true,c:[{cN:\"operator\",b:\"(begin|start|commit|rollback|savepoint|lock|alter|create|drop|rename|call|delete|do|handler|insert|load|replace|select|truncate|update|set|show|pragma|grant)\\\\b(?!:)\",e:\";\",eW:true,k:{keyword:\"all partial global month current_timestamp using go revoke smallint indicator end-exec disconnect zone with character assertion to add current_user usage input local alter match collate real then rollback get read timestamp session_user not integer bit unique day minute desc insert execute like ilike|2 level decimal drop continue isolation found where constraints domain right national some module transaction relative second connect escape close system_user for deferred section cast current sqlstate allocate intersect deallocate numeric public preserve full goto initially asc no key output collation group by union session both last language constraint column of space foreign deferrable prior connection unknown action commit view or first into float year primary cascaded except restrict set references names table outer open select size are rows from prepare distinct leading create only next inner authorization schema corresponding option declare precision immediate else timezone_minute external varying translation true case exception join hour default double scroll value cursor descriptor values dec fetch procedure delete and false int is describe char as at in varchar null trailing any absolute current_time end grant privileges when cross check write current_date pad begin temporary exec time update catalog user sql date on identity timezone_hour natural whenever interval work order cascade diagnostics nchar having left call do handler load replace truncate start lock show pragma exists number\",aggregate:\"count sum min max avg\"},c:[{cN:\"string\",b:\"'\",e:\"'\",c:[a.BE,{b:\"''\"}],r:0},{cN:\"string\",b:'\"',e:'\"',c:[a.BE,{b:'\"\"'}],r:0},{cN:\"string\",b:\"`\",e:\"`\",c:[a.BE]},a.CNM]},a.CBLCLM,{cN:\"comment\",b:\"--\",e:\"$\"}]}}(hljs);hljs.LANGUAGES.vala=function(a){return{k:{keyword:\"char uchar unichar int uint long ulong short ushort int8 int16 int32 int64 uint8 uint16 uint32 uint64 float double bool struct enum string void weak unowned owned async signal static abstract interface override while do for foreach else switch case break default return try catch public private protected internal using new this get set const stdout stdin stderr var\",built_in:\"DBus GLib CCode Gee Object\",literal:\"false true null\"},c:[{cN:\"class\",bWK:true,e:\"{\",k:\"class interface delegate namespace\",c:[{bWK:true,k:\"extends implements\"},{cN:\"title\",b:a.UIR}]},a.CLCM,a.CBLCLM,{cN:\"string\",b:'\"\"\"',e:'\"\"\"',r:5},a.ASM,a.QSM,a.CNM,{cN:\"preprocessor\",b:\"^#\",e:\"$\",r:2},{cN:\"constant\",b:\" [A-Z_]+ \",r:0}]}}(hljs);hljs.LANGUAGES.ini=function(a){return{cI:true,i:\"[^\\\\s]\",c:[{cN:\"comment\",b:\";\",e:\"$\"},{cN:\"title\",b:\"^\\\\[\",e:\"\\\\]\"},{cN:\"setting\",b:\"^[a-z0-9\\\\[\\\\]_-]+[ \\\\t]*=[ \\\\t]*\",e:\"$\",c:[{cN:\"value\",eW:true,k:\"on off true false yes no\",c:[a.QSM,a.NM]}]}]}}(hljs);hljs.LANGUAGES.d=function(x){var b={keyword:\"abstract alias align asm assert auto body break byte case cast catch class const continue debug default delete deprecated do else enum export extern final finally for foreach foreach_reverse|10 goto if immutable import in inout int interface invariant is lazy macro mixin module new nothrow out override package pragma private protected public pure ref return scope shared static struct super switch synchronized template this throw try typedef typeid typeof union unittest version void volatile while with __FILE__ __LINE__ __gshared|10 __thread __traits __DATE__ __EOF__ __TIME__ __TIMESTAMP__ __VENDOR__ __VERSION__\",built_in:\"bool cdouble cent cfloat char creal dchar delegate double dstring float function idouble ifloat ireal long real short string ubyte ucent uint ulong ushort wchar wstring\",literal:\"false null true\"};var c=\"(0|[1-9][\\\\d_]*)\",q=\"(0|[1-9][\\\\d_]*|\\\\d[\\\\d_]*|[\\\\d_]+?\\\\d)\",h=\"0[bB][01_]+\",v=\"([\\\\da-fA-F][\\\\da-fA-F_]*|_[\\\\da-fA-F][\\\\da-fA-F_]*)\",y=\"0[xX]\"+v,p=\"([eE][+-]?\"+q+\")\",o=\"(\"+q+\"(\\\\.\\\\d*|\"+p+\")|\\\\d+\\\\.\"+q+q+\"|\\\\.\"+c+p+\"?)\",k=\"(0[xX](\"+v+\"\\\\.\"+v+\"|\\\\.?\"+v+\")[pP][+-]?\"+q+\")\",l=\"(\"+c+\"|\"+h+\"|\"+y+\")\",n=\"(\"+k+\"|\"+o+\")\";var z=\"\\\\\\\\(['\\\"\\\\?\\\\\\\\abfnrtv]|u[\\\\dA-Fa-f]{4}|[0-7]{1,3}|x[\\\\dA-Fa-f]{2}|U[\\\\dA-Fa-f]{8})|&[a-zA-Z\\\\d]{2,};\";var m={cN:\"number\",b:\"\\\\b\"+l+\"(L|u|U|Lu|LU|uL|UL)?\",r:0};var j={cN:\"number\",b:\"\\\\b(\"+n+\"([fF]|L|i|[fF]i|Li)?|\"+l+\"(i|[fF]i|Li))\",r:0};var s={cN:\"string\",b:\"'(\"+z+\"|.)\",e:\"'\",i:\".\"};var r={b:z,r:0};var w={cN:\"string\",b:'\"',c:[r],e:'\"[cwd]?',r:0};var f={cN:\"string\",b:'[rq]\"',e:'\"[cwd]?',r:5};var u={cN:\"string\",b:\"`\",e:\"`[cwd]?\"};var i={cN:\"string\",b:'x\"[\\\\da-fA-F\\\\s\\\\n\\\\r]*\"[cwd]?',r:10};var t={cN:\"string\",b:'q\"\\\\{',e:'\\\\}\"'};var e={cN:\"shebang\",b:\"^#!\",e:\"$\",r:5};var g={cN:\"preprocessor\",b:\"#(line)\",e:\"$\",r:5};var d={cN:\"keyword\",b:\"@[a-zA-Z_][a-zA-Z_\\\\d]*\"};var a={cN:\"comment\",b:\"\\\\/\\\\+\",c:[\"self\"],e:\"\\\\+\\\\/\",r:10};return{l:x.UIR,k:b,c:[x.CLCM,x.CBLCLM,a,i,w,f,u,t,j,m,s,e,g,d]}}(hljs);hljs.LANGUAGES.axapta=function(a){return{k:\"false int abstract private char interface boolean static null if for true while long throw finally protected extends final implements return void enum else break new catch byte super class case short default double public try this switch continue reverse firstfast firstonly forupdate nofetch sum avg minof maxof count order group by asc desc index hint like dispaly edit client server ttsbegin ttscommit str real date container anytype common div mod\",c:[a.CLCM,a.CBLCLM,a.ASM,a.QSM,a.CNM,{cN:\"preprocessor\",b:\"#\",e:\"$\"},{cN:\"class\",bWK:true,e:\"{\",i:\":\",k:\"class interface\",c:[{cN:\"inheritance\",bWK:true,k:\"extends implements\",r:10},{cN:\"title\",b:a.UIR}]}]}}(hljs);hljs.LANGUAGES.perl=function(e){var a=\"getpwent getservent quotemeta msgrcv scalar kill dbmclose undef lc ma syswrite tr send umask sysopen shmwrite vec qx utime local oct semctl localtime readpipe do return format read sprintf dbmopen pop getpgrp not getpwnam rewinddir qqfileno qw endprotoent wait sethostent bless s|0 opendir continue each sleep endgrent shutdown dump chomp connect getsockname die socketpair close flock exists index shmgetsub for endpwent redo lstat msgctl setpgrp abs exit select print ref gethostbyaddr unshift fcntl syscall goto getnetbyaddr join gmtime symlink semget splice x|0 getpeername recv log setsockopt cos last reverse gethostbyname getgrnam study formline endhostent times chop length gethostent getnetent pack getprotoent getservbyname rand mkdir pos chmod y|0 substr endnetent printf next open msgsnd readdir use unlink getsockopt getpriority rindex wantarray hex system getservbyport endservent int chr untie rmdir prototype tell listen fork shmread ucfirst setprotoent else sysseek link getgrgid shmctl waitpid unpack getnetbyname reset chdir grep split require caller lcfirst until warn while values shift telldir getpwuid my getprotobynumber delete and sort uc defined srand accept package seekdir getprotobyname semop our rename seek if q|0 chroot sysread setpwent no crypt getc chown sqrt write setnetent setpriority foreach tie sin msgget map stat getlogin unless elsif truncate exec keys glob tied closedirioctl socket readlink eval xor readline binmode setservent eof ord bind alarm pipe atan2 getgrent exp time push setgrent gt lt or ne m|0 break given say state when\";var d={cN:\"subst\",b:\"[$@]\\\\{\",e:\"\\\\}\",k:a,r:10};var b={cN:\"variable\",b:\"\\\\$\\\\d\"};var i={cN:\"variable\",b:\"[\\\\$\\\\%\\\\@\\\\*](\\\\^\\\\w\\\\b|#\\\\w+(\\\\:\\\\:\\\\w+)*|[^\\\\s\\\\w{]|{\\\\w+}|\\\\w+(\\\\:\\\\:\\\\w*)*)\"};var f=[e.BE,d,b,i];var h={b:\"->\",c:[{b:e.IR},{b:\"{\",e:\"}\"}]};var g={cN:\"comment\",b:\"^(__END__|__DATA__)\",e:\"\\\\n$\",r:5};var c=[b,i,e.HCM,g,{cN:\"comment\",b:\"^\\\\=\\\\w\",e:\"\\\\=cut\",eW:true},h,{cN:\"string\",b:\"q[qwxr]?\\\\s*\\\\(\",e:\"\\\\)\",c:f,r:5},{cN:\"string\",b:\"q[qwxr]?\\\\s*\\\\[\",e:\"\\\\]\",c:f,r:5},{cN:\"string\",b:\"q[qwxr]?\\\\s*\\\\{\",e:\"\\\\}\",c:f,r:5},{cN:\"string\",b:\"q[qwxr]?\\\\s*\\\\|\",e:\"\\\\|\",c:f,r:5},{cN:\"string\",b:\"q[qwxr]?\\\\s*\\\\<\",e:\"\\\\>\",c:f,r:5},{cN:\"string\",b:\"qw\\\\s+q\",e:\"q\",c:f,r:5},{cN:\"string\",b:\"'\",e:\"'\",c:[e.BE],r:0},{cN:\"string\",b:'\"',e:'\"',c:f,r:0},{cN:\"string\",b:\"`\",e:\"`\",c:[e.BE]},{cN:\"string\",b:\"{\\\\w+}\",r:0},{cN:\"string\",b:\"-?\\\\w+\\\\s*\\\\=\\\\>\",r:0},{cN:\"number\",b:\"(\\\\b0[0-7_]+)|(\\\\b0x[0-9a-fA-F_]+)|(\\\\b[1-9][0-9_]*(\\\\.[0-9_]+)?)|[0_]\\\\b\",r:0},{b:\"(\"+e.RSR+\"|\\\\b(split|return|print|reverse|grep)\\\\b)\\\\s*\",k:\"split return print reverse grep\",r:0,c:[e.HCM,g,{cN:\"regexp\",b:\"(s|tr|y)/(\\\\\\\\.|[^/])*/(\\\\\\\\.|[^/])*/[a-z]*\",r:10},{cN:\"regexp\",b:\"(m|qr)?/\",e:\"/[a-z]*\",c:[e.BE],r:0}]},{cN:\"sub\",bWK:true,e:\"(\\\\s*\\\\(.*?\\\\))?[;{]\",k:\"sub\",r:5},{cN:\"operator\",b:\"-\\\\w\\\\b\",r:0}];d.c=c;h.c[1].c=c;return{k:a,c:c}}(hljs);hljs.LANGUAGES.scala=function(a){var c={cN:\"annotation\",b:\"@[A-Za-z]+\"};var b={cN:\"string\",b:'u?r?\"\"\"',e:'\"\"\"',r:10};return{k:\"type yield lazy override def with val var false true sealed abstract private trait object null if for while throw finally protected extends import final return else break new catch super class case package default try this match continue throws\",c:[{cN:\"javadoc\",b:\"/\\\\*\\\\*\",e:\"\\\\*/\",c:[{cN:\"javadoctag\",b:\"@[A-Za-z]+\"}],r:10},a.CLCM,a.CBLCLM,a.ASM,a.QSM,b,{cN:\"class\",b:\"((case )?class |object |trait )\",e:\"({|$)\",i:\":\",k:\"case class trait object\",c:[{bWK:true,k:\"extends with\",r:10},{cN:\"title\",b:a.UIR},{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",c:[a.ASM,a.QSM,b,c]}]},a.CNM,c]}}(hljs);hljs.LANGUAGES.cmake=function(a){return{cI:true,k:\"add_custom_command add_custom_target add_definitions add_dependencies add_executable add_library add_subdirectory add_test aux_source_directory break build_command cmake_minimum_required cmake_policy configure_file create_test_sourcelist define_property else elseif enable_language enable_testing endforeach endfunction endif endmacro endwhile execute_process export find_file find_library find_package find_path find_program fltk_wrap_ui foreach function get_cmake_property get_directory_property get_filename_component get_property get_source_file_property get_target_property get_test_property if include include_directories include_external_msproject include_regular_expression install link_directories load_cache load_command macro mark_as_advanced message option output_required_files project qt_wrap_cpp qt_wrap_ui remove_definitions return separate_arguments set set_directory_properties set_property set_source_files_properties set_target_properties set_tests_properties site_name source_group string target_link_libraries try_compile try_run unset variable_watch while build_name exec_program export_library_dependencies install_files install_programs install_targets link_libraries make_directory remove subdir_depends subdirs use_mangled_mesa utility_source variable_requires write_file\",c:[{cN:\"envvar\",b:\"\\\\${\",e:\"}\"},a.HCM,a.QSM,a.NM]}}(hljs);hljs.LANGUAGES.objectivec=function(a){var b={keyword:\"int float while private char catch export sizeof typedef const struct for union unsigned long volatile static protected bool mutable if public do return goto void enum else break extern class asm case short default double throw register explicit signed typename try this switch continue wchar_t inline readonly assign property protocol self synchronized end synthesize id optional required implementation nonatomic interface super unichar finally dynamic IBOutlet IBAction selector strong weak readonly\",literal:\"false true FALSE TRUE nil YES NO NULL\",built_in:\"NSString NSDictionary CGRect CGPoint UIButton UILabel UITextView UIWebView MKMapView UISegmentedControl NSObject UITableViewDelegate UITableViewDataSource NSThread UIActivityIndicator UITabbar UIToolBar UIBarButtonItem UIImageView NSAutoreleasePool UITableView BOOL NSInteger CGFloat NSException NSLog NSMutableString NSMutableArray NSMutableDictionary NSURL NSIndexPath CGSize UITableViewCell UIView UIViewController UINavigationBar UINavigationController UITabBarController UIPopoverController UIPopoverControllerDelegate UIImage NSNumber UISearchBar NSFetchedResultsController NSFetchedResultsChangeType UIScrollView UIScrollViewDelegate UIEdgeInsets UIColor UIFont UIApplication NSNotFound NSNotificationCenter NSNotification UILocalNotification NSBundle NSFileManager NSTimeInterval NSDate NSCalendar NSUserDefaults UIWindow NSRange NSArray NSError NSURLRequest NSURLConnection class UIInterfaceOrientation MPMoviePlayerController dispatch_once_t dispatch_queue_t dispatch_sync dispatch_async dispatch_once\"};return{k:b,i:\"</\",c:[a.CLCM,a.CBLCLM,a.CNM,a.QSM,{cN:\"string\",b:\"'\",e:\"[^\\\\\\\\]'\",i:\"[^\\\\\\\\][^']\"},{cN:\"preprocessor\",b:\"#import\",e:\"$\",c:[{cN:\"title\",b:'\"',e:'\"'},{cN:\"title\",b:\"<\",e:\">\"}]},{cN:\"preprocessor\",b:\"#\",e:\"$\"},{cN:\"class\",bWK:true,e:\"({|$)\",k:\"interface class protocol implementation\",c:[{cN:\"id\",b:a.UIR}]},{cN:\"variable\",b:\"\\\\.\"+a.UIR}]}}(hljs);hljs.LANGUAGES.avrasm=function(a){return{cI:true,k:{keyword:\"adc add adiw and andi asr bclr bld brbc brbs brcc brcs break breq brge brhc brhs brid brie brlo brlt brmi brne brpl brsh brtc brts brvc brvs bset bst call cbi cbr clc clh cli cln clr cls clt clv clz com cp cpc cpi cpse dec eicall eijmp elpm eor fmul fmuls fmulsu icall ijmp in inc jmp ld ldd ldi lds lpm lsl lsr mov movw mul muls mulsu neg nop or ori out pop push rcall ret reti rjmp rol ror sbc sbr sbrc sbrs sec seh sbi sbci sbic sbis sbiw sei sen ser ses set sev sez sleep spm st std sts sub subi swap tst wdr\",built_in:\"r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 r16 r17 r18 r19 r20 r21 r22 r23 r24 r25 r26 r27 r28 r29 r30 r31 x|0 xh xl y|0 yh yl z|0 zh zl ucsr1c udr1 ucsr1a ucsr1b ubrr1l ubrr1h ucsr0c ubrr0h tccr3c tccr3a tccr3b tcnt3h tcnt3l ocr3ah ocr3al ocr3bh ocr3bl ocr3ch ocr3cl icr3h icr3l etimsk etifr tccr1c ocr1ch ocr1cl twcr twdr twar twsr twbr osccal xmcra xmcrb eicra spmcsr spmcr portg ddrg ping portf ddrf sreg sph spl xdiv rampz eicrb eimsk gimsk gicr eifr gifr timsk tifr mcucr mcucsr tccr0 tcnt0 ocr0 assr tccr1a tccr1b tcnt1h tcnt1l ocr1ah ocr1al ocr1bh ocr1bl icr1h icr1l tccr2 tcnt2 ocr2 ocdr wdtcr sfior eearh eearl eedr eecr porta ddra pina portb ddrb pinb portc ddrc pinc portd ddrd pind spdr spsr spcr udr0 ucsr0a ucsr0b ubrr0l acsr admux adcsr adch adcl porte ddre pine pinf\"},c:[a.CBLCLM,{cN:\"comment\",b:\";\",e:\"$\"},a.CNM,a.BNM,{cN:\"number\",b:\"\\\\b(\\\\$[a-zA-Z0-9]+|0o[0-7]+)\"},a.QSM,{cN:\"string\",b:\"'\",e:\"[^\\\\\\\\]'\",i:\"[^\\\\\\\\][^']\"},{cN:\"label\",b:\"^[A-Za-z0-9_.$]+:\"},{cN:\"preprocessor\",b:\"#\",e:\"$\"},{cN:\"preprocessor\",b:\"\\\\.[a-zA-Z]+\"},{cN:\"localvars\",b:\"@[0-9]+\"}]}}(hljs);hljs.LANGUAGES.vhdl=function(a){return{cI:true,k:{keyword:\"abs access after alias all and architecture array assert attribute begin block body buffer bus case component configuration constant context cover disconnect downto default else elsif end entity exit fairness file for force function generate generic group guarded if impure in inertial inout is label library linkage literal loop map mod nand new next nor not null of on open or others out package port postponed procedure process property protected pure range record register reject release rem report restrict restrict_guarantee return rol ror select sequence severity shared signal sla sll sra srl strong subtype then to transport type unaffected units until use variable vmode vprop vunit wait when while with xnor xor\",typename:\"boolean bit character severity_level integer time delay_length natural positive string bit_vector file_open_kind file_open_status std_ulogic std_ulogic_vector std_logic std_logic_vector unsigned signed boolean_vector integer_vector real_vector time_vector\"},i:\"{\",c:[a.CBLCLM,{cN:\"comment\",b:\"--\",e:\"$\"},a.QSM,a.CNM,{cN:\"literal\",b:\"'(U|X|0|1|Z|W|L|H|-)'\",c:[a.BE]},{cN:\"attribute\",b:\"'[A-Za-z](_?[A-Za-z0-9])*\",c:[a.BE]}]}}(hljs);hljs.LANGUAGES.coffeescript=function(c){var b={keyword:\"in if for while finally new do return else break catch instanceof throw try this switch continue typeof delete debugger super then unless until loop of by when and or is isnt not\",literal:\"true false null undefined yes no on off \",reserved:\"case default function var void with const let enum export import native __hasProp __extends __slice __bind __indexOf\"};var a=\"[A-Za-z$_][0-9A-Za-z$_]*\";var e={cN:\"title\",b:a};var d={cN:\"subst\",b:\"#\\\\{\",e:\"}\",k:b,c:[c.BNM,c.CNM]};return{k:b,c:[c.BNM,c.CNM,c.ASM,{cN:\"string\",b:'\"\"\"',e:'\"\"\"',c:[c.BE,d]},{cN:\"string\",b:'\"',e:'\"',c:[c.BE,d],r:0},{cN:\"comment\",b:\"###\",e:\"###\"},c.HCM,{cN:\"regexp\",b:\"///\",e:\"///\",c:[c.HCM]},{cN:\"regexp\",b:\"//[gim]*\"},{cN:\"regexp\",b:\"/\\\\S(\\\\\\\\.|[^\\\\n])*/[gim]*\"},{b:\"`\",e:\"`\",eB:true,eE:true,sL:\"javascript\"},{cN:\"function\",b:a+\"\\\\s*=\\\\s*(\\\\(.+\\\\))?\\\\s*[-=]>\",rB:true,c:[e,{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\"}]},{cN:\"class\",bWK:true,k:\"class\",e:\"$\",i:\":\",c:[{bWK:true,k:\"extends\",eW:true,i:\":\",c:[e]},e]},{cN:\"property\",b:\"@\"+a}]}}(hljs);hljs.LANGUAGES.nginx=function(b){var c=[{cN:\"variable\",b:\"\\\\$\\\\d+\"},{cN:\"variable\",b:\"\\\\${\",e:\"}\"},{cN:\"variable\",b:\"[\\\\$\\\\@]\"+b.UIR}];var a={eW:true,l:\"[a-z/_]+\",k:{built_in:\"on off yes no true false none blocked debug info notice warn error crit select break last permanent redirect kqueue rtsig epoll poll /dev/poll\"},r:0,i:\"=>\",c:[b.HCM,{cN:\"string\",b:'\"',e:'\"',c:[b.BE].concat(c),r:0},{cN:\"string\",b:\"'\",e:\"'\",c:[b.BE].concat(c),r:0},{cN:\"url\",b:\"([a-z]+):/\",e:\"\\\\s\",eW:true,eE:true},{cN:\"regexp\",b:\"\\\\s\\\\^\",e:\"\\\\s|{|;\",rE:true,c:[b.BE].concat(c)},{cN:\"regexp\",b:\"~\\\\*?\\\\s+\",e:\"\\\\s|{|;\",rE:true,c:[b.BE].concat(c)},{cN:\"regexp\",b:\"\\\\*(\\\\.[a-z\\\\-]+)+\",c:[b.BE].concat(c)},{cN:\"regexp\",b:\"([a-z\\\\-]+\\\\.)+\\\\*\",c:[b.BE].concat(c)},{cN:\"number\",b:\"\\\\b\\\\d{1,3}\\\\.\\\\d{1,3}\\\\.\\\\d{1,3}\\\\.\\\\d{1,3}(:\\\\d{1,5})?\\\\b\"},{cN:\"number\",b:\"\\\\b\\\\d+[kKmMgGdshdwy]*\\\\b\",r:0}].concat(c)};return{c:[b.HCM,{b:b.UIR+\"\\\\s\",e:\";|{\",rB:true,c:[{cN:\"title\",b:b.UIR,starts:a}]}],i:\"[^\\\\s\\\\}]\"}}(hljs);hljs.LANGUAGES[\"erlang-repl\"]=function(a){return{k:{special_functions:\"spawn spawn_link self\",reserved:\"after and andalso|10 band begin bnot bor bsl bsr bxor case catch cond div end fun if let not of or orelse|10 query receive rem try when xor\"},c:[{cN:\"prompt\",b:\"^[0-9]+> \",r:10},{cN:\"comment\",b:\"%\",e:\"$\"},{cN:\"number\",b:\"\\\\b(\\\\d+#[a-fA-F0-9]+|\\\\d+(\\\\.\\\\d+)?([eE][-+]?\\\\d+)?)\",r:0},a.ASM,a.QSM,{cN:\"constant\",b:\"\\\\?(::)?([A-Z]\\\\w*(::)?)+\"},{cN:\"arrow\",b:\"->\"},{cN:\"ok\",b:\"ok\"},{cN:\"exclamation_mark\",b:\"!\"},{cN:\"function_or_atom\",b:\"(\\\\b[a-z'][a-zA-Z0-9_']*:[a-z'][a-zA-Z0-9_']*)|(\\\\b[a-z'][a-zA-Z0-9_']*)\",r:0},{cN:\"variable\",b:\"[A-Z][a-zA-Z0-9_']*\",r:0}]}}(hljs);hljs.LANGUAGES.r=function(a){var b=\"([a-zA-Z]|\\\\.[a-zA-Z.])[a-zA-Z0-9._]*\";return{c:[a.HCM,{b:b,l:b,k:{keyword:\"function if in break next repeat else for return switch while try tryCatch|10 stop warning require library attach detach source setMethod setGeneric setGroupGeneric setClass ...|10\",literal:\"NULL NA TRUE FALSE T F Inf NaN NA_integer_|10 NA_real_|10 NA_character_|10 NA_complex_|10\"},r:0},{cN:\"number\",b:\"0[xX][0-9a-fA-F]+[Li]?\\\\b\",r:0},{cN:\"number\",b:\"\\\\d+(?:[eE][+\\\\-]?\\\\d*)?L\\\\b\",r:0},{cN:\"number\",b:\"\\\\d+\\\\.(?!\\\\d)(?:i\\\\b)?\",r:0},{cN:\"number\",b:\"\\\\d+(?:\\\\.\\\\d*)?(?:[eE][+\\\\-]?\\\\d*)?i?\\\\b\",r:0},{cN:\"number\",b:\"\\\\.\\\\d+(?:[eE][+\\\\-]?\\\\d*)?i?\\\\b\",r:0},{b:\"`\",e:\"`\",r:0},{cN:\"string\",b:'\"',e:'\"',c:[a.BE],r:0},{cN:\"string\",b:\"'\",e:\"'\",c:[a.BE],r:0}]}}(hljs);hljs.LANGUAGES.json=function(a){var e={literal:\"true false null\"};var d=[a.QSM,a.CNM];var c={cN:\"value\",e:\",\",eW:true,eE:true,c:d,k:e};var b={b:\"{\",e:\"}\",c:[{cN:\"attribute\",b:'\\\\s*\"',e:'\"\\\\s*:\\\\s*',eB:true,eE:true,c:[a.BE],i:\"\\\\n\",starts:c}],i:\"\\\\S\"};var f={b:\"\\\\[\",e:\"\\\\]\",c:[a.inherit(c,{cN:null})],i:\"\\\\S\"};d.splice(d.length,0,b,f);return{c:d,k:e,i:\"\\\\S\"}}(hljs);hljs.LANGUAGES.django=function(c){function e(h,g){return(g==undefined||(!h.cN&&g.cN==\"tag\")||h.cN==\"value\")}function f(l,k){var g={};for(var j in l){if(j!=\"contains\"){g[j]=l[j]}var m=[];for(var h=0;l.c&&h<l.c.length;h++){m.push(f(l.c[h],l))}if(e(l,k)){m=b.concat(m)}if(m.length){g.c=m}}return g}var d={cN:\"filter\",b:\"\\\\|[A-Za-z]+\\\\:?\",eE:true,k:\"truncatewords removetags linebreaksbr yesno get_digit timesince random striptags filesizeformat escape linebreaks length_is ljust rjust cut urlize fix_ampersands title floatformat capfirst pprint divisibleby add make_list unordered_list urlencode timeuntil urlizetrunc wordcount stringformat linenumbers slice date dictsort dictsortreversed default_if_none pluralize lower join center default truncatewords_html upper length phone2numeric wordwrap time addslashes slugify first escapejs force_escape iriencode last safe safeseq truncatechars localize unlocalize localtime utc timezone\",c:[{cN:\"argument\",b:'\"',e:'\"'}]};var b=[{cN:\"template_comment\",b:\"{%\\\\s*comment\\\\s*%}\",e:\"{%\\\\s*endcomment\\\\s*%}\"},{cN:\"template_comment\",b:\"{#\",e:\"#}\"},{cN:\"template_tag\",b:\"{%\",e:\"%}\",k:\"comment endcomment load templatetag ifchanged endifchanged if endif firstof for endfor in ifnotequal endifnotequal widthratio extends include spaceless endspaceless regroup by as ifequal endifequal ssi now with cycle url filter endfilter debug block endblock else autoescape endautoescape csrf_token empty elif endwith static trans blocktrans endblocktrans get_static_prefix get_media_prefix plural get_current_language language get_available_languages get_current_language_bidi get_language_info get_language_info_list localize endlocalize localtime endlocaltime timezone endtimezone get_current_timezone\",c:[d]},{cN:\"variable\",b:\"{{\",e:\"}}\",c:[d]}];var a=f(c.LANGUAGES.xml);a.cI=true;return a}(hljs);hljs.LANGUAGES.delphi=function(b){var f=\"and safecall cdecl then string exports library not pascal set virtual file in array label packed end. index while const raise for to implementation with except overload destructor downto finally program exit unit inherited override if type until function do begin repeat goto nil far initialization object else var uses external resourcestring interface end finalization class asm mod case on shr shl of register xorwrite threadvar try record near stored constructor stdcall inline div out or procedure\";var e=\"safecall stdcall pascal stored const implementation finalization except to finally program inherited override then exports string read not mod shr try div shl set library message packed index for near overload label downto exit public goto interface asm on of constructor or private array unit raise destructor var type until function else external with case default record while protected property procedure published and cdecl do threadvar file in if end virtual write far out begin repeat nil initialization object uses resourcestring class register xorwrite inline static\";var a={cN:\"comment\",b:\"{\",e:\"}\",r:0};var g={cN:\"comment\",b:\"\\\\(\\\\*\",e:\"\\\\*\\\\)\",r:10};var c={cN:\"string\",b:\"'\",e:\"'\",c:[{b:\"''\"}],r:0};var d={cN:\"string\",b:\"(#\\\\d+)+\"};var h={cN:\"function\",bWK:true,e:\"[:;]\",k:\"function constructor|10 destructor|10 procedure|10\",c:[{cN:\"title\",b:b.IR},{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",k:f,c:[c,d]},a,g]};return{cI:true,k:f,i:'(\"|\\\\$[G-Zg-z]|\\\\/\\\\*|</)',c:[a,g,b.CLCM,c,d,b.NM,h,{cN:\"class\",b:\"=\\\\bclass\\\\b\",e:\"end;\",k:e,c:[c,d,a,g,b.CLCM,h]}]}}(hljs);hljs.LANGUAGES.vbscript=function(a){return{cI:true,k:{keyword:\"call class const dim do loop erase execute executeglobal exit for each next function if then else on error option explicit new private property let get public randomize redim rem select case set stop sub while wend with end to elseif is or xor and not class_initialize class_terminate default preserve in me byval byref step resume goto\",built_in:\"lcase month vartype instrrev ubound setlocale getobject rgb getref string weekdayname rnd dateadd monthname now day minute isarray cbool round formatcurrency conversions csng timevalue second year space abs clng timeserial fixs len asc isempty maths dateserial atn timer isobject filter weekday datevalue ccur isdate instr datediff formatdatetime replace isnull right sgn array snumeric log cdbl hex chr lbound msgbox ucase getlocale cos cdate cbyte rtrim join hour oct typename trim strcomp int createobject loadpicture tan formatnumber mid scriptenginebuildversion scriptengine split scriptengineminorversion cint sin datepart ltrim sqr scriptenginemajorversion time derived eval date formatpercent exp inputbox left ascw chrw regexp server response request cstr err\",literal:\"true false null nothing empty\"},i:\"//\",c:[a.inherit(a.QSM,{c:[{b:'\"\"'}]}),{cN:\"comment\",b:\"'\",e:\"$\"},a.CNM]}}(hljs);hljs.LANGUAGES.mel=function(a){return{k:\"int float string vector matrix if else switch case default while do for in break continue global proc return about abs addAttr addAttributeEditorNodeHelp addDynamic addNewShelfTab addPP addPanelCategory addPrefixToName advanceToNextDrivenKey affectedNet affects aimConstraint air alias aliasAttr align alignCtx alignCurve alignSurface allViewFit ambientLight angle angleBetween animCone animCurveEditor animDisplay animView annotate appendStringArray applicationName applyAttrPreset applyTake arcLenDimContext arcLengthDimension arclen arrayMapper art3dPaintCtx artAttrCtx artAttrPaintVertexCtx artAttrSkinPaintCtx artAttrTool artBuildPaintMenu artFluidAttrCtx artPuttyCtx artSelectCtx artSetPaintCtx artUserPaintCtx assignCommand assignInputDevice assignViewportFactories attachCurve attachDeviceAttr attachSurface attrColorSliderGrp attrCompatibility attrControlGrp attrEnumOptionMenu attrEnumOptionMenuGrp attrFieldGrp attrFieldSliderGrp attrNavigationControlGrp attrPresetEditWin attributeExists attributeInfo attributeMenu attributeQuery autoKeyframe autoPlace bakeClip bakeFluidShading bakePartialHistory bakeResults bakeSimulation basename basenameEx batchRender bessel bevel bevelPlus binMembership bindSkin blend2 blendShape blendShapeEditor blendShapePanel blendTwoAttr blindDataType boneLattice boundary boxDollyCtx boxZoomCtx bufferCurve buildBookmarkMenu buildKeyframeMenu button buttonManip CBG cacheFile cacheFileCombine cacheFileMerge cacheFileTrack camera cameraView canCreateManip canvas capitalizeString catch catchQuiet ceil changeSubdivComponentDisplayLevel changeSubdivRegion channelBox character characterMap characterOutlineEditor characterize chdir checkBox checkBoxGrp checkDefaultRenderGlobals choice circle circularFillet clamp clear clearCache clip clipEditor clipEditorCurrentTimeCtx clipSchedule clipSchedulerOutliner clipTrimBefore closeCurve closeSurface cluster cmdFileOutput cmdScrollFieldExecuter cmdScrollFieldReporter cmdShell coarsenSubdivSelectionList collision color colorAtPoint colorEditor colorIndex colorIndexSliderGrp colorSliderButtonGrp colorSliderGrp columnLayout commandEcho commandLine commandPort compactHairSystem componentEditor compositingInterop computePolysetVolume condition cone confirmDialog connectAttr connectControl connectDynamic connectJoint connectionInfo constrain constrainValue constructionHistory container containsMultibyte contextInfo control convertFromOldLayers convertIffToPsd convertLightmap convertSolidTx convertTessellation convertUnit copyArray copyFlexor copyKey copySkinWeights cos cpButton cpCache cpClothSet cpCollision cpConstraint cpConvClothToMesh cpForces cpGetSolverAttr cpPanel cpProperty cpRigidCollisionFilter cpSeam cpSetEdit cpSetSolverAttr cpSolver cpSolverTypes cpTool cpUpdateClothUVs createDisplayLayer createDrawCtx createEditor createLayeredPsdFile createMotionField createNewShelf createNode createRenderLayer createSubdivRegion cross crossProduct ctxAbort ctxCompletion ctxEditMode ctxTraverse currentCtx currentTime currentTimeCtx currentUnit currentUnit curve curveAddPtCtx curveCVCtx curveEPCtx curveEditorCtx curveIntersect curveMoveEPCtx curveOnSurface curveSketchCtx cutKey cycleCheck cylinder dagPose date defaultLightListCheckBox defaultNavigation defineDataServer defineVirtualDevice deformer deg_to_rad delete deleteAttr deleteShadingGroupsAndMaterials deleteShelfTab deleteUI deleteUnusedBrushes delrandstr detachCurve detachDeviceAttr detachSurface deviceEditor devicePanel dgInfo dgdirty dgeval dgtimer dimWhen directKeyCtx directionalLight dirmap dirname disable disconnectAttr disconnectJoint diskCache displacementToPoly displayAffected displayColor displayCull displayLevelOfDetail displayPref displayRGBColor displaySmoothness displayStats displayString displaySurface distanceDimContext distanceDimension doBlur dolly dollyCtx dopeSheetEditor dot dotProduct doubleProfileBirailSurface drag dragAttrContext draggerContext dropoffLocator duplicate duplicateCurve duplicateSurface dynCache dynControl dynExport dynExpression dynGlobals dynPaintEditor dynParticleCtx dynPref dynRelEdPanel dynRelEditor dynamicLoad editAttrLimits editDisplayLayerGlobals editDisplayLayerMembers editRenderLayerAdjustment editRenderLayerGlobals editRenderLayerMembers editor editorTemplate effector emit emitter enableDevice encodeString endString endsWith env equivalent equivalentTol erf error eval eval evalDeferred evalEcho event exactWorldBoundingBox exclusiveLightCheckBox exec executeForEachObject exists exp expression expressionEditorListen extendCurve extendSurface extrude fcheck fclose feof fflush fgetline fgetword file fileBrowserDialog fileDialog fileExtension fileInfo filetest filletCurve filter filterCurve filterExpand filterStudioImport findAllIntersections findAnimCurves findKeyframe findMenuItem findRelatedSkinCluster finder firstParentOf fitBspline flexor floatEq floatField floatFieldGrp floatScrollBar floatSlider floatSlider2 floatSliderButtonGrp floatSliderGrp floor flow fluidCacheInfo fluidEmitter fluidVoxelInfo flushUndo fmod fontDialog fopen formLayout format fprint frameLayout fread freeFormFillet frewind fromNativePath fwrite gamma gauss geometryConstraint getApplicationVersionAsFloat getAttr getClassification getDefaultBrush getFileList getFluidAttr getInputDeviceRange getMayaPanelTypes getModifiers getPanel getParticleAttr getPluginResource getenv getpid glRender glRenderEditor globalStitch gmatch goal gotoBindPose grabColor gradientControl gradientControlNoAttr graphDollyCtx graphSelectContext graphTrackCtx gravity grid gridLayout group groupObjectsByName HfAddAttractorToAS HfAssignAS HfBuildEqualMap HfBuildFurFiles HfBuildFurImages HfCancelAFR HfConnectASToHF HfCreateAttractor HfDeleteAS HfEditAS HfPerformCreateAS HfRemoveAttractorFromAS HfSelectAttached HfSelectAttractors HfUnAssignAS hardenPointCurve hardware hardwareRenderPanel headsUpDisplay headsUpMessage help helpLine hermite hide hilite hitTest hotBox hotkey hotkeyCheck hsv_to_rgb hudButton hudSlider hudSliderButton hwReflectionMap hwRender hwRenderLoad hyperGraph hyperPanel hyperShade hypot iconTextButton iconTextCheckBox iconTextRadioButton iconTextRadioCollection iconTextScrollList iconTextStaticLabel ikHandle ikHandleCtx ikHandleDisplayScale ikSolver ikSplineHandleCtx ikSystem ikSystemInfo ikfkDisplayMethod illustratorCurves image imfPlugins inheritTransform insertJoint insertJointCtx insertKeyCtx insertKnotCurve insertKnotSurface instance instanceable instancer intField intFieldGrp intScrollBar intSlider intSliderGrp interToUI internalVar intersect iprEngine isAnimCurve isConnected isDirty isParentOf isSameObject isTrue isValidObjectName isValidString isValidUiName isolateSelect itemFilter itemFilterAttr itemFilterRender itemFilterType joint jointCluster jointCtx jointDisplayScale jointLattice keyTangent keyframe keyframeOutliner keyframeRegionCurrentTimeCtx keyframeRegionDirectKeyCtx keyframeRegionDollyCtx keyframeRegionInsertKeyCtx keyframeRegionMoveKeyCtx keyframeRegionScaleKeyCtx keyframeRegionSelectKeyCtx keyframeRegionSetKeyCtx keyframeRegionTrackCtx keyframeStats lassoContext lattice latticeDeformKeyCtx launch launchImageEditor layerButton layeredShaderPort layeredTexturePort layout layoutDialog lightList lightListEditor lightListPanel lightlink lineIntersection linearPrecision linstep listAnimatable listAttr listCameras listConnections listDeviceAttachments listHistory listInputDeviceAxes listInputDeviceButtons listInputDevices listMenuAnnotation listNodeTypes listPanelCategories listRelatives listSets listTransforms listUnselected listerEditor loadFluid loadNewShelf loadPlugin loadPluginLanguageResources loadPrefObjects localizedPanelLabel lockNode loft log longNameOf lookThru ls lsThroughFilter lsType lsUI Mayatomr mag makeIdentity makeLive makePaintable makeRoll makeSingleSurface makeTubeOn makebot manipMoveContext manipMoveLimitsCtx manipOptions manipRotateContext manipRotateLimitsCtx manipScaleContext manipScaleLimitsCtx marker match max memory menu menuBarLayout menuEditor menuItem menuItemToShelf menuSet menuSetPref messageLine min minimizeApp mirrorJoint modelCurrentTimeCtx modelEditor modelPanel mouse movIn movOut move moveIKtoFK moveKeyCtx moveVertexAlongDirection multiProfileBirailSurface mute nParticle nameCommand nameField namespace namespaceInfo newPanelItems newton nodeCast nodeIconButton nodeOutliner nodePreset nodeType noise nonLinear normalConstraint normalize nurbsBoolean nurbsCopyUVSet nurbsCube nurbsEditUV nurbsPlane nurbsSelect nurbsSquare nurbsToPoly nurbsToPolygonsPref nurbsToSubdiv nurbsToSubdivPref nurbsUVSet nurbsViewDirectionVector objExists objectCenter objectLayer objectType objectTypeUI obsoleteProc oceanNurbsPreviewPlane offsetCurve offsetCurveOnSurface offsetSurface openGLExtension openMayaPref optionMenu optionMenuGrp optionVar orbit orbitCtx orientConstraint outlinerEditor outlinerPanel overrideModifier paintEffectsDisplay pairBlend palettePort paneLayout panel panelConfiguration panelHistory paramDimContext paramDimension paramLocator parent parentConstraint particle particleExists particleInstancer particleRenderInfo partition pasteKey pathAnimation pause pclose percent performanceOptions pfxstrokes pickWalk picture pixelMove planarSrf plane play playbackOptions playblast plugAttr plugNode pluginInfo pluginResourceUtil pointConstraint pointCurveConstraint pointLight pointMatrixMult pointOnCurve pointOnSurface pointPosition poleVectorConstraint polyAppend polyAppendFacetCtx polyAppendVertex polyAutoProjection polyAverageNormal polyAverageVertex polyBevel polyBlendColor polyBlindData polyBoolOp polyBridgeEdge polyCacheMonitor polyCheck polyChipOff polyClipboard polyCloseBorder polyCollapseEdge polyCollapseFacet polyColorBlindData polyColorDel polyColorPerVertex polyColorSet polyCompare polyCone polyCopyUV polyCrease polyCreaseCtx polyCreateFacet polyCreateFacetCtx polyCube polyCut polyCutCtx polyCylinder polyCylindricalProjection polyDelEdge polyDelFacet polyDelVertex polyDuplicateAndConnect polyDuplicateEdge polyEditUV polyEditUVShell polyEvaluate polyExtrudeEdge polyExtrudeFacet polyExtrudeVertex polyFlipEdge polyFlipUV polyForceUV polyGeoSampler polyHelix polyInfo polyInstallAction polyLayoutUV polyListComponentConversion polyMapCut polyMapDel polyMapSew polyMapSewMove polyMergeEdge polyMergeEdgeCtx polyMergeFacet polyMergeFacetCtx polyMergeUV polyMergeVertex polyMirrorFace polyMoveEdge polyMoveFacet polyMoveFacetUV polyMoveUV polyMoveVertex polyNormal polyNormalPerVertex polyNormalizeUV polyOptUvs polyOptions polyOutput polyPipe polyPlanarProjection polyPlane polyPlatonicSolid polyPoke polyPrimitive polyPrism polyProjection polyPyramid polyQuad polyQueryBlindData polyReduce polySelect polySelectConstraint polySelectConstraintMonitor polySelectCtx polySelectEditCtx polySeparate polySetToFaceNormal polySewEdge polyShortestPathCtx polySmooth polySoftEdge polySphere polySphericalProjection polySplit polySplitCtx polySplitEdge polySplitRing polySplitVertex polyStraightenUVBorder polySubdivideEdge polySubdivideFacet polyToSubdiv polyTorus polyTransfer polyTriangulate polyUVSet polyUnite polyWedgeFace popen popupMenu pose pow preloadRefEd print progressBar progressWindow projFileViewer projectCurve projectTangent projectionContext projectionManip promptDialog propModCtx propMove psdChannelOutliner psdEditTextureFile psdExport psdTextureFile putenv pwd python querySubdiv quit rad_to_deg radial radioButton radioButtonGrp radioCollection radioMenuItemCollection rampColorPort rand randomizeFollicles randstate rangeControl readTake rebuildCurve rebuildSurface recordAttr recordDevice redo reference referenceEdit referenceQuery refineSubdivSelectionList refresh refreshAE registerPluginResource rehash reloadImage removeJoint removeMultiInstance removePanelCategory rename renameAttr renameSelectionList renameUI render renderGlobalsNode renderInfo renderLayerButton renderLayerParent renderLayerPostProcess renderLayerUnparent renderManip renderPartition renderQualityNode renderSettings renderThumbnailUpdate renderWindowEditor renderWindowSelectContext renderer reorder reorderDeformers requires reroot resampleFluid resetAE resetPfxToPolyCamera resetTool resolutionNode retarget reverseCurve reverseSurface revolve rgb_to_hsv rigidBody rigidSolver roll rollCtx rootOf rot rotate rotationInterpolation roundConstantRadius rowColumnLayout rowLayout runTimeCommand runup sampleImage saveAllShelves saveAttrPreset saveFluid saveImage saveInitialState saveMenu savePrefObjects savePrefs saveShelf saveToolSettings scale scaleBrushBrightness scaleComponents scaleConstraint scaleKey scaleKeyCtx sceneEditor sceneUIReplacement scmh scriptCtx scriptEditorInfo scriptJob scriptNode scriptTable scriptToShelf scriptedPanel scriptedPanelType scrollField scrollLayout sculpt searchPathArray seed selLoadSettings select selectContext selectCurveCV selectKey selectKeyCtx selectKeyframeRegionCtx selectMode selectPref selectPriority selectType selectedNodes selectionConnection separator setAttr setAttrEnumResource setAttrMapping setAttrNiceNameResource setConstraintRestPosition setDefaultShadingGroup setDrivenKeyframe setDynamic setEditCtx setEditor setFluidAttr setFocus setInfinity setInputDeviceMapping setKeyCtx setKeyPath setKeyframe setKeyframeBlendshapeTargetWts setMenuMode setNodeNiceNameResource setNodeTypeFlag setParent setParticleAttr setPfxToPolyCamera setPluginResource setProject setStampDensity setStartupMessage setState setToolTo setUITemplate setXformManip sets shadingConnection shadingGeometryRelCtx shadingLightRelCtx shadingNetworkCompare shadingNode shapeCompare shelfButton shelfLayout shelfTabLayout shellField shortNameOf showHelp showHidden showManipCtx showSelectionInTitle showShadingGroupAttrEditor showWindow sign simplify sin singleProfileBirailSurface size sizeBytes skinCluster skinPercent smoothCurve smoothTangentSurface smoothstep snap2to2 snapKey snapMode snapTogetherCtx snapshot soft softMod softModCtx sort sound soundControl source spaceLocator sphere sphrand spotLight spotLightPreviewPort spreadSheetEditor spring sqrt squareSurface srtContext stackTrace startString startsWith stitchAndExplodeShell stitchSurface stitchSurfacePoints strcmp stringArrayCatenate stringArrayContains stringArrayCount stringArrayInsertAtIndex stringArrayIntersector stringArrayRemove stringArrayRemoveAtIndex stringArrayRemoveDuplicates stringArrayRemoveExact stringArrayToString stringToStringArray strip stripPrefixFromName stroke subdAutoProjection subdCleanTopology subdCollapse subdDuplicateAndConnect subdEditUV subdListComponentConversion subdMapCut subdMapSewMove subdMatchTopology subdMirror subdToBlind subdToPoly subdTransferUVsToCache subdiv subdivCrease subdivDisplaySmoothness substitute substituteAllString substituteGeometry substring surface surfaceSampler surfaceShaderList swatchDisplayPort switchTable symbolButton symbolCheckBox sysFile system tabLayout tan tangentConstraint texLatticeDeformContext texManipContext texMoveContext texMoveUVShellContext texRotateContext texScaleContext texSelectContext texSelectShortestPathCtx texSmudgeUVContext texWinToolCtx text textCurves textField textFieldButtonGrp textFieldGrp textManip textScrollList textToShelf textureDisplacePlane textureHairColor texturePlacementContext textureWindow threadCount threePointArcCtx timeControl timePort timerX toNativePath toggle toggleAxis toggleWindowVisibility tokenize tokenizeList tolerance tolower toolButton toolCollection toolDropped toolHasOptions toolPropertyWindow torus toupper trace track trackCtx transferAttributes transformCompare transformLimits translator trim trunc truncateFluidCache truncateHairCache tumble tumbleCtx turbulence twoPointArcCtx uiRes uiTemplate unassignInputDevice undo undoInfo ungroup uniform unit unloadPlugin untangleUV untitledFileName untrim upAxis updateAE userCtx uvLink uvSnapshot validateShelfName vectorize view2dToolCtx viewCamera viewClipPlane viewFit viewHeadOn viewLookAt viewManip viewPlace viewSet visor volumeAxis vortex waitCursor warning webBrowser webBrowserPrefs whatIs window windowPref wire wireContext workspace wrinkle wrinkleContext writeTake xbmLangPathList xform\",i:\"</\",c:[a.CNM,a.ASM,a.QSM,{cN:\"string\",b:\"`\",e:\"`\",c:[a.BE]},{cN:\"variable\",b:\"\\\\$\\\\d\",r:5},{cN:\"variable\",b:\"[\\\\$\\\\%\\\\@\\\\*](\\\\^\\\\w\\\\b|#\\\\w+|[^\\\\s\\\\w{]|{\\\\w+}|\\\\w+)\"},a.CLCM,a.CBLCLM]}}(hljs);hljs.LANGUAGES.dos=function(a){return{cI:true,k:{flow:\"if else goto for in do call exit not exist errorlevel defined equ neq lss leq gtr geq\",keyword:\"shift cd dir echo setlocal endlocal set pause copy\",stream:\"prn nul lpt3 lpt2 lpt1 con com4 com3 com2 com1 aux\",winutils:\"ping net ipconfig taskkill xcopy ren del\"},c:[{cN:\"envvar\",b:\"%%[^ ]\"},{cN:\"envvar\",b:\"%[^ ]+?%\"},{cN:\"envvar\",b:\"![^ ]+?!\"},{cN:\"number\",b:\"\\\\b\\\\d+\",r:0},{cN:\"comment\",b:\"@?rem\",e:\"$\"}]}}(hljs);hljs.LANGUAGES.apache=function(a){var b={cN:\"number\",b:\"[\\\\$%]\\\\d+\"};return{cI:true,k:{keyword:\"acceptfilter acceptmutex acceptpathinfo accessfilename action addalt addaltbyencoding addaltbytype addcharset adddefaultcharset adddescription addencoding addhandler addicon addiconbyencoding addiconbytype addinputfilter addlanguage addmoduleinfo addoutputfilter addoutputfilterbytype addtype alias aliasmatch allow allowconnect allowencodedslashes allowoverride anonymous anonymous_logemail anonymous_mustgiveemail anonymous_nouserid anonymous_verifyemail authbasicauthoritative authbasicprovider authdbduserpwquery authdbduserrealmquery authdbmgroupfile authdbmtype authdbmuserfile authdefaultauthoritative authdigestalgorithm authdigestdomain authdigestnccheck authdigestnonceformat authdigestnoncelifetime authdigestprovider authdigestqop authdigestshmemsize authgroupfile authldapbinddn authldapbindpassword authldapcharsetconfig authldapcomparednonserver authldapdereferencealiases authldapgroupattribute authldapgroupattributeisdn authldapremoteuserattribute authldapremoteuserisdn authldapurl authname authnprovideralias authtype authuserfile authzdbmauthoritative authzdbmtype authzdefaultauthoritative authzgroupfileauthoritative authzldapauthoritative authzownerauthoritative authzuserauthoritative balancermember browsermatch browsermatchnocase bufferedlogs cachedefaultexpire cachedirlength cachedirlevels cachedisable cacheenable cachefile cacheignorecachecontrol cacheignoreheaders cacheignorenolastmod cacheignorequerystring cachelastmodifiedfactor cachemaxexpire cachemaxfilesize cacheminfilesize cachenegotiateddocs cacheroot cachestorenostore cachestoreprivate cgimapextension charsetdefault charsetoptions charsetsourceenc checkcaseonly checkspelling chrootdir contentdigest cookiedomain cookieexpires cookielog cookiename cookiestyle cookietracking coredumpdirectory customlog dav davdepthinfinity davgenericlockdb davlockdb davmintimeout dbdexptime dbdkeep dbdmax dbdmin dbdparams dbdpersist dbdpreparesql dbdriver defaulticon defaultlanguage defaulttype deflatebuffersize deflatecompressionlevel deflatefilternote deflatememlevel deflatewindowsize deny directoryindex directorymatch directoryslash documentroot dumpioinput dumpiologlevel dumpiooutput enableexceptionhook enablemmap enablesendfile errordocument errorlog example expiresactive expiresbytype expiresdefault extendedstatus extfilterdefine extfilteroptions fileetag filterchain filterdeclare filterprotocol filterprovider filtertrace forcelanguagepriority forcetype forensiclog gracefulshutdowntimeout group header headername hostnamelookups identitycheck identitychecktimeout imapbase imapdefault imapmenu include indexheadinsert indexignore indexoptions indexorderdefault indexstylesheet isapiappendlogtoerrors isapiappendlogtoquery isapicachefile isapifakeasync isapilognotsupported isapireadaheadbuffer keepalive keepalivetimeout languagepriority ldapcacheentries ldapcachettl ldapconnectiontimeout ldapopcacheentries ldapopcachettl ldapsharedcachefile ldapsharedcachesize ldaptrustedclientcert ldaptrustedglobalcert ldaptrustedmode ldapverifyservercert limitinternalrecursion limitrequestbody limitrequestfields limitrequestfieldsize limitrequestline limitxmlrequestbody listen listenbacklog loadfile loadmodule lockfile logformat loglevel maxclients maxkeepaliverequests maxmemfree maxrequestsperchild maxrequestsperthread maxspareservers maxsparethreads maxthreads mcachemaxobjectcount mcachemaxobjectsize mcachemaxstreamingbuffer mcacheminobjectsize mcacheremovalalgorithm mcachesize metadir metafiles metasuffix mimemagicfile minspareservers minsparethreads mmapfile mod_gzip_on mod_gzip_add_header_count mod_gzip_keep_workfiles mod_gzip_dechunk mod_gzip_min_http mod_gzip_minimum_file_size mod_gzip_maximum_file_size mod_gzip_maximum_inmem_size mod_gzip_temp_dir mod_gzip_item_include mod_gzip_item_exclude mod_gzip_command_version mod_gzip_can_negotiate mod_gzip_handle_methods mod_gzip_static_suffix mod_gzip_send_vary mod_gzip_update_static modmimeusepathinfo multiviewsmatch namevirtualhost noproxy nwssltrustedcerts nwsslupgradeable options order passenv pidfile protocolecho proxybadheader proxyblock proxydomain proxyerroroverride proxyftpdircharset proxyiobuffersize proxymaxforwards proxypass proxypassinterpolateenv proxypassmatch proxypassreverse proxypassreversecookiedomain proxypassreversecookiepath proxypreservehost proxyreceivebuffersize proxyremote proxyremotematch proxyrequests proxyset proxystatus proxytimeout proxyvia readmename receivebuffersize redirect redirectmatch redirectpermanent redirecttemp removecharset removeencoding removehandler removeinputfilter removelanguage removeoutputfilter removetype requestheader require rewritebase rewritecond rewriteengine rewritelock rewritelog rewriteloglevel rewritemap rewriteoptions rewriterule rlimitcpu rlimitmem rlimitnproc satisfy scoreboardfile script scriptalias scriptaliasmatch scriptinterpretersource scriptlog scriptlogbuffer scriptloglength scriptsock securelisten seerequesttail sendbuffersize serveradmin serveralias serverlimit servername serverpath serverroot serversignature servertokens setenv setenvif setenvifnocase sethandler setinputfilter setoutputfilter ssienableaccess ssiendtag ssierrormsg ssistarttag ssitimeformat ssiundefinedecho sslcacertificatefile sslcacertificatepath sslcadnrequestfile sslcadnrequestpath sslcarevocationfile sslcarevocationpath sslcertificatechainfile sslcertificatefile sslcertificatekeyfile sslciphersuite sslcryptodevice sslengine sslhonorciperorder sslmutex ssloptions sslpassphrasedialog sslprotocol sslproxycacertificatefile sslproxycacertificatepath sslproxycarevocationfile sslproxycarevocationpath sslproxyciphersuite sslproxyengine sslproxymachinecertificatefile sslproxymachinecertificatepath sslproxyprotocol sslproxyverify sslproxyverifydepth sslrandomseed sslrequire sslrequiressl sslsessioncache sslsessioncachetimeout sslusername sslverifyclient sslverifydepth startservers startthreads substitute suexecusergroup threadlimit threadsperchild threadstacksize timeout traceenable transferlog typesconfig unsetenv usecanonicalname usecanonicalphysicalport user userdir virtualdocumentroot virtualdocumentrootip virtualscriptalias virtualscriptaliasip win32disableacceptex xbithack\",literal:\"on off\"},c:[a.HCM,{cN:\"sqbracket\",b:\"\\\\s\\\\[\",e:\"\\\\]$\"},{cN:\"cbracket\",b:\"[\\\\$%]\\\\{\",e:\"\\\\}\",c:[\"self\",b]},b,{cN:\"tag\",b:\"</?\",e:\">\"},a.QSM]}}(hljs);hljs.LANGUAGES.applescript=function(a){var b=a.inherit(a.QSM,{i:\"\"});var e={cN:\"title\",b:a.UIR};var d={cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",c:[\"self\",a.CNM,b]};var c=[{cN:\"comment\",b:\"--\",e:\"$\",},{cN:\"comment\",b:\"\\\\(\\\\*\",e:\"\\\\*\\\\)\",c:[\"self\",{b:\"--\",e:\"$\"}]},a.HCM];return{k:{keyword:\"about above after against and around as at back before beginning behind below beneath beside between but by considering contain contains continue copy div does eighth else end equal equals error every exit fifth first for fourth from front get given global if ignoring in into is it its last local me middle mod my ninth not of on onto or over prop property put ref reference repeat returning script second set seventh since sixth some tell tenth that the then third through thru timeout times to transaction try until where while whose with without\",constant:\"AppleScript false linefeed return pi quote result space tab true\",type:\"alias application boolean class constant date file integer list number real record string text\",command:\"activate beep count delay launch log offset read round run say summarize write\",property:\"character characters contents day frontmost id item length month name paragraph paragraphs rest reverse running time version weekday word words year\"},c:[b,a.CNM,{cN:\"type\",b:\"\\\\bPOSIX file\\\\b\"},{cN:\"command\",b:\"\\\\b(clipboard info|the clipboard|info for|list (disks|folder)|mount volume|path to|(close|open for) access|(get|set) eof|current date|do shell script|get volume settings|random number|set volume|system attribute|system info|time to GMT|(load|run|store) script|scripting components|ASCII (character|number)|localized string|choose (application|color|file|file name|folder|from list|remote application|URL)|display (alert|dialog))\\\\b|^\\\\s*return\\\\b\"},{cN:\"constant\",b:\"\\\\b(text item delimiters|current application|missing value)\\\\b\"},{cN:\"keyword\",b:\"\\\\b(apart from|aside from|instead of|out of|greater than|isn't|(doesn't|does not) (equal|come before|come after|contain)|(greater|less) than( or equal)?|(starts?|ends|begins?) with|contained by|comes (before|after)|a (ref|reference))\\\\b\"},{cN:\"property\",b:\"\\\\b(POSIX path|(date|time) string|quoted form)\\\\b\"},{cN:\"function_start\",bWK:true,k:\"on\",i:\"[${=;\\\\n]\",c:[e,d]}].concat(c)}}(hljs);hljs.LANGUAGES.cpp=function(a){var b={keyword:\"false int float while private char catch export virtual operator sizeof dynamic_cast|10 typedef const_cast|10 const struct for static_cast|10 union namespace unsigned long throw volatile static protected bool template mutable if public friend do return goto auto void enum else break new extern using true class asm case typeid short reinterpret_cast|10 default double register explicit signed typename try this switch continue wchar_t inline delete alignof char16_t char32_t constexpr decltype noexcept nullptr static_assert thread_local restrict _Bool complex\",built_in:\"std string cin cout cerr clog stringstream istringstream ostringstream auto_ptr deque list queue stack vector map set bitset multiset multimap unordered_set unordered_map unordered_multiset unordered_multimap array shared_ptr\"};return{k:b,i:\"</\",c:[a.CLCM,a.CBLCLM,a.QSM,{cN:\"string\",b:\"'\\\\\\\\?.\",e:\"'\",i:\".\"},{cN:\"number\",b:\"\\\\b(\\\\d+(\\\\.\\\\d*)?|\\\\.\\\\d+)(u|U|l|L|ul|UL|f|F)\"},a.CNM,{cN:\"preprocessor\",b:\"#\",e:\"$\"},{cN:\"stl_container\",b:\"\\\\b(deque|list|queue|stack|vector|map|set|bitset|multiset|multimap|unordered_map|unordered_set|unordered_multiset|unordered_multimap|array)\\\\s*<\",e:\">\",k:b,r:10,c:[\"self\"]}]}}(hljs);hljs.LANGUAGES.matlab=function(a){var b=[a.CNM,{cN:\"string\",b:\"'\",e:\"'\",c:[a.BE,{b:\"''\"}],r:0}];return{k:{keyword:\"break case catch classdef continue else elseif end enumerated events for function global if methods otherwise parfor persistent properties return spmd switch try while\",built_in:\"sin sind sinh asin asind asinh cos cosd cosh acos acosd acosh tan tand tanh atan atand atan2 atanh sec secd sech asec asecd asech csc cscd csch acsc acscd acsch cot cotd coth acot acotd acoth hypot exp expm1 log log1p log10 log2 pow2 realpow reallog realsqrt sqrt nthroot nextpow2 abs angle complex conj imag real unwrap isreal cplxpair fix floor ceil round mod rem sign airy besselj bessely besselh besseli besselk beta betainc betaln ellipj ellipke erf erfc erfcx erfinv expint gamma gammainc gammaln psi legendre cross dot factor isprime primes gcd lcm rat rats perms nchoosek factorial cart2sph cart2pol pol2cart sph2cart hsv2rgb rgb2hsv zeros ones eye repmat rand randn linspace logspace freqspace meshgrid accumarray size length ndims numel disp isempty isequal isequalwithequalnans cat reshape diag blkdiag tril triu fliplr flipud flipdim rot90 find sub2ind ind2sub bsxfun ndgrid permute ipermute shiftdim circshift squeeze isscalar isvector ans eps realmax realmin pi i inf nan isnan isinf isfinite j why compan gallery hadamard hankel hilb invhilb magic pascal rosser toeplitz vander wilkinson\"},i:'(//|\"|#|/\\\\*|\\\\s+/\\\\w+)',c:[{cN:\"function\",bWK:true,e:\"$\",k:\"function\",c:[{cN:\"title\",b:a.UIR},{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\"},{cN:\"params\",b:\"\\\\[\",e:\"\\\\]\"}]},{cN:\"transposed_variable\",b:\"[a-zA-Z_][a-zA-Z_0-9]*('+[\\\\.']*|[\\\\.']+)\",e:\"\"},{cN:\"matrix\",b:\"\\\\[\",e:\"\\\\]'*[\\\\.']*\",c:b},{cN:\"cell\",b:\"\\\\{\",e:\"\\\\}'*[\\\\.']*\",c:b},{cN:\"comment\",b:\"\\\\%\",e:\"$\"}].concat(b)}}(hljs);hljs.LANGUAGES.parser3=function(a){return{sL:\"xml\",c:[{cN:\"comment\",b:\"^#\",e:\"$\"},{cN:\"comment\",b:\"\\\\^rem{\",e:\"}\",r:10,c:[{b:\"{\",e:\"}\",c:[\"self\"]}]},{cN:\"preprocessor\",b:\"^@(?:BASE|USE|CLASS|OPTIONS)$\",r:10},{cN:\"title\",b:\"@[\\\\w\\\\-]+\\\\[[\\\\w^;\\\\-]*\\\\](?:\\\\[[\\\\w^;\\\\-]*\\\\])?(?:.*)$\"},{cN:\"variable\",b:\"\\\\$\\\\{?[\\\\w\\\\-\\\\.\\\\:]+\\\\}?\"},{cN:\"keyword\",b:\"\\\\^[\\\\w\\\\-\\\\.\\\\:]+\"},{cN:\"number\",b:\"\\\\^#[0-9a-fA-F]+\"},a.CNM]}}(hljs);hljs.LANGUAGES.clojure=function(l){var e={built_in:\"def cond apply if-not if-let if not not= = &lt; < > &lt;= <= >= == + / * - rem quot neg? pos? delay? symbol? keyword? true? false? integer? empty? coll? list? set? ifn? fn? associative? sequential? sorted? counted? reversible? number? decimal? class? distinct? isa? float? rational? reduced? ratio? odd? even? char? seq? vector? string? map? nil? contains? zero? instance? not-every? not-any? libspec? -> ->> .. . inc compare do dotimes mapcat take remove take-while drop letfn drop-last take-last drop-while while intern condp case reduced cycle split-at split-with repeat replicate iterate range merge zipmap declare line-seq sort comparator sort-by dorun doall nthnext nthrest partition eval doseq await await-for let agent atom send send-off release-pending-sends add-watch mapv filterv remove-watch agent-error restart-agent set-error-handler error-handler set-error-mode! error-mode shutdown-agents quote var fn loop recur throw try monitor-enter monitor-exit defmacro defn defn- macroexpand macroexpand-1 for doseq dosync dotimes and or when when-not when-let comp juxt partial sequence memoize constantly complement identity assert peek pop doto proxy defstruct first rest cons defprotocol cast coll deftype defrecord last butlast sigs reify second ffirst fnext nfirst nnext defmulti defmethod meta with-meta ns in-ns create-ns import intern refer keys select-keys vals key val rseq name namespace promise into transient persistent! conj! assoc! dissoc! pop! disj! import use class type num float double short byte boolean bigint biginteger bigdec print-method print-dup throw-if throw printf format load compile get-in update-in pr pr-on newline flush read slurp read-line subvec with-open memfn time ns assert re-find re-groups rand-int rand mod locking assert-valid-fdecl alias namespace resolve ref deref refset swap! reset! set-validator! compare-and-set! alter-meta! reset-meta! commute get-validator alter ref-set ref-history-count ref-min-history ref-max-history ensure sync io! new next conj set! memfn to-array future future-call into-array aset gen-class reduce merge map filter find empty hash-map hash-set sorted-map sorted-map-by sorted-set sorted-set-by vec vector seq flatten reverse assoc dissoc list disj get union difference intersection extend extend-type extend-protocol int nth delay count concat chunk chunk-buffer chunk-append chunk-first chunk-rest max min dec unchecked-inc-int unchecked-inc unchecked-dec-inc unchecked-dec unchecked-negate unchecked-add-int unchecked-add unchecked-subtract-int unchecked-subtract chunk-next chunk-cons chunked-seq? prn vary-meta lazy-seq spread list* str find-keyword keyword symbol gensym force rationalize\"};var f=\"[a-zA-Z_0-9\\\\!\\\\.\\\\?\\\\-\\\\+\\\\*\\\\/\\\\<\\\\=\\\\>\\\\&\\\\#\\\\$';]+\";var a=\"[\\\\s:\\\\(\\\\{]+\\\\d+(\\\\.\\\\d+)?\";var d={cN:\"number\",b:a,r:0};var j={cN:\"string\",b:'\"',e:'\"',c:[l.BE],r:0};var o={cN:\"comment\",b:\";\",e:\"$\",r:0};var n={cN:\"collection\",b:\"[\\\\[\\\\{]\",e:\"[\\\\]\\\\}]\"};var c={cN:\"comment\",b:\"\\\\^\"+f};var b={cN:\"comment\",b:\"\\\\^\\\\{\",e:\"\\\\}\"};var h={cN:\"attribute\",b:\"[:]\"+f};var m={cN:\"list\",b:\"\\\\(\",e:\"\\\\)\",r:0};var g={eW:true,eE:true,k:{literal:\"true false nil\"},r:0};var i={k:e,l:f,cN:\"title\",b:f,starts:g};m.c=[{cN:\"comment\",b:\"comment\"},i];g.c=[m,j,c,b,o,h,n,d];n.c=[m,j,c,o,h,n,d];return{i:\"\\\\S\",c:[o,m]}}(hljs);hljs.LANGUAGES.go=function(a){var b={keyword:\"break default func interface select case map struct chan else goto package switch const fallthrough if range type continue for import return var go defer\",constant:\"true false iota nil\",typename:\"bool byte complex64 complex128 float32 float64 int8 int16 int32 int64 string uint8 uint16 uint32 uint64 int uint uintptr rune\",built_in:\"append cap close complex copy imag len make new panic print println real recover delete\"};return{k:b,i:\"</\",c:[a.CLCM,a.CBLCLM,a.QSM,{cN:\"string\",b:\"'\",e:\"[^\\\\\\\\]'\",r:0},{cN:\"string\",b:\"`\",e:\"`\"},{cN:\"number\",b:\"[^a-zA-Z_0-9](\\\\-|\\\\+)?\\\\d+(\\\\.\\\\d+|\\\\/\\\\d+)?((d|e|f|l|s)(\\\\+|\\\\-)?\\\\d+)?\",r:0},a.CNM]}}(hljs);module.exports=hljs;",
          "type": "blob"
        },
        "lib/marked.js": {
          "path": "lib/marked.js",
          "mode": "100644",
          "content": "/**\n * marked - a markdown parser\n * Copyright (c) 2011-2013, Christopher Jeffrey. (MIT Licensed)\n * https://github.com/chjj/marked\n */\n\n;(function() {\n\n/**\n * Block-Level Grammar\n */\n\nvar block = {\n  newline: /^\\n+/,\n  code: /^( {4}[^\\n]+\\n*)+/,\n  fences: noop,\n  hr: /^( *[-*_]){3,} *(?:\\n+|$)/,\n  heading: /^ *(#{1,6}) *([^\\n]+?) *#* *(?:\\n+|$)/,\n  nptable: noop,\n  lheading: /^([^\\n]+)\\n *(=|-){2,} *(?:\\n+|$)/,\n  blockquote: /^( *>[^\\n]+(\\n[^\\n]+)*\\n*)+/,\n  list: /^( *)(bull) [\\s\\S]+?(?:hr|\\n{2,}(?! )(?!\\1bull )\\n*|\\s*$)/,\n  html: /^ *(?:comment|closed|closing) *(?:\\n{2,}|\\s*$)/,\n  def: /^ *\\[([^\\]]+)\\]: *<?([^\\s>]+)>?(?: +[\"(]([^\\n]+)[\")])? *(?:\\n+|$)/,\n  table: noop,\n  paragraph: /^((?:[^\\n]+\\n?(?!hr|heading|lheading|blockquote|tag|def))+)\\n*/,\n  text: /^[^\\n]+/\n};\n\nblock.bullet = /(?:[*+-]|\\d+\\.)/;\nblock.item = /^( *)(bull) [^\\n]*(?:\\n(?!\\1bull )[^\\n]*)*/;\nblock.item = replace(block.item, 'gm')\n  (/bull/g, block.bullet)\n  ();\n\nblock.list = replace(block.list)\n  (/bull/g, block.bullet)\n  ('hr', /\\n+(?=(?: *[-*_]){3,} *(?:\\n+|$))/)\n  ();\n\nblock._tag = '(?!(?:'\n  + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code'\n  + '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo'\n  + '|span|br|wbr|ins|del|img)\\\\b)\\\\w+(?!:/|@)\\\\b';\n\nblock.html = replace(block.html)\n  ('comment', /<!--[\\s\\S]*?-->/)\n  ('closed', /<(tag)[\\s\\S]+?<\\/\\1>/)\n  ('closing', /<tag(?:\"[^\"]*\"|'[^']*'|[^'\">])*?>/)\n  (/tag/g, block._tag)\n  ();\n\nblock.paragraph = replace(block.paragraph)\n  ('hr', block.hr)\n  ('heading', block.heading)\n  ('lheading', block.lheading)\n  ('blockquote', block.blockquote)\n  ('tag', '<' + block._tag)\n  ('def', block.def)\n  ();\n\n/**\n * Normal Block Grammar\n */\n\nblock.normal = merge({}, block);\n\n/**\n * GFM Block Grammar\n */\n\nblock.gfm = merge({}, block.normal, {\n  fences: /^ *(`{3,}|~{3,}) *(\\S+)? *\\n([\\s\\S]+?)\\s*\\1 *(?:\\n+|$)/,\n  paragraph: /^/\n});\n\nblock.gfm.paragraph = replace(block.paragraph)\n  ('(?!', '(?!'\n    + block.gfm.fences.source.replace('\\\\1', '\\\\2') + '|'\n    + block.list.source.replace('\\\\1', '\\\\3') + '|')\n  ();\n\n/**\n * GFM + Tables Block Grammar\n */\n\nblock.tables = merge({}, block.gfm, {\n  nptable: /^ *(\\S.*\\|.*)\\n *([-:]+ *\\|[-| :]*)\\n((?:.*\\|.*(?:\\n|$))*)\\n*/,\n  table: /^ *\\|(.+)\\n *\\|( *[-:]+[-| :]*)\\n((?: *\\|.*(?:\\n|$))*)\\n*/\n});\n\n/**\n * Block Lexer\n */\n\nfunction Lexer(options) {\n  this.tokens = [];\n  this.tokens.links = {};\n  this.options = options || marked.defaults;\n  this.rules = block.normal;\n\n  if (this.options.gfm) {\n    if (this.options.tables) {\n      this.rules = block.tables;\n    } else {\n      this.rules = block.gfm;\n    }\n  }\n}\n\n/**\n * Expose Block Rules\n */\n\nLexer.rules = block;\n\n/**\n * Static Lex Method\n */\n\nLexer.lex = function(src, options) {\n  var lexer = new Lexer(options);\n  return lexer.lex(src);\n};\n\n/**\n * Preprocessing\n */\n\nLexer.prototype.lex = function(src) {\n  src = src\n    .replace(/\\r\\n|\\r/g, '\\n')\n    .replace(/\\t/g, '    ')\n    .replace(/\\u00a0/g, ' ')\n    .replace(/\\u2424/g, '\\n');\n\n  return this.token(src, true);\n};\n\n/**\n * Lexing\n */\n\nLexer.prototype.token = function(src, top) {\n  var src = src.replace(/^ +$/gm, '')\n    , next\n    , loose\n    , cap\n    , bull\n    , b\n    , item\n    , space\n    , i\n    , l;\n\n  while (src) {\n    // newline\n    if (cap = this.rules.newline.exec(src)) {\n      src = src.substring(cap[0].length);\n      if (cap[0].length > 1) {\n        this.tokens.push({\n          type: 'space'\n        });\n      }\n    }\n\n    // code\n    if (cap = this.rules.code.exec(src)) {\n      src = src.substring(cap[0].length);\n      cap = cap[0].replace(/^ {4}/gm, '');\n      this.tokens.push({\n        type: 'code',\n        text: !this.options.pedantic\n          ? cap.replace(/\\n+$/, '')\n          : cap\n      });\n      continue;\n    }\n\n    // fences (gfm)\n    if (cap = this.rules.fences.exec(src)) {\n      src = src.substring(cap[0].length);\n      this.tokens.push({\n        type: 'code',\n        lang: cap[2],\n        text: cap[3]\n      });\n      continue;\n    }\n\n    // heading\n    if (cap = this.rules.heading.exec(src)) {\n      src = src.substring(cap[0].length);\n      this.tokens.push({\n        type: 'heading',\n        depth: cap[1].length,\n        text: cap[2]\n      });\n      continue;\n    }\n\n    // table no leading pipe (gfm)\n    if (top && (cap = this.rules.nptable.exec(src))) {\n      src = src.substring(cap[0].length);\n\n      item = {\n        type: 'table',\n        header: cap[1].replace(/^ *| *\\| *$/g, '').split(/ *\\| */),\n        align: cap[2].replace(/^ *|\\| *$/g, '').split(/ *\\| */),\n        cells: cap[3].replace(/\\n$/, '').split('\\n')\n      };\n\n      for (i = 0; i < item.align.length; i++) {\n        if (/^ *-+: *$/.test(item.align[i])) {\n          item.align[i] = 'right';\n        } else if (/^ *:-+: *$/.test(item.align[i])) {\n          item.align[i] = 'center';\n        } else if (/^ *:-+ *$/.test(item.align[i])) {\n          item.align[i] = 'left';\n        } else {\n          item.align[i] = null;\n        }\n      }\n\n      for (i = 0; i < item.cells.length; i++) {\n        item.cells[i] = item.cells[i].split(/ *\\| */);\n      }\n\n      this.tokens.push(item);\n\n      continue;\n    }\n\n    // lheading\n    if (cap = this.rules.lheading.exec(src)) {\n      src = src.substring(cap[0].length);\n      this.tokens.push({\n        type: 'heading',\n        depth: cap[2] === '=' ? 1 : 2,\n        text: cap[1]\n      });\n      continue;\n    }\n\n    // hr\n    if (cap = this.rules.hr.exec(src)) {\n      src = src.substring(cap[0].length);\n      this.tokens.push({\n        type: 'hr'\n      });\n      continue;\n    }\n\n    // blockquote\n    if (cap = this.rules.blockquote.exec(src)) {\n      src = src.substring(cap[0].length);\n\n      this.tokens.push({\n        type: 'blockquote_start'\n      });\n\n      cap = cap[0].replace(/^ *> ?/gm, '');\n\n      // Pass `top` to keep the current\n      // \"toplevel\" state. This is exactly\n      // how markdown.pl works.\n      this.token(cap, top);\n\n      this.tokens.push({\n        type: 'blockquote_end'\n      });\n\n      continue;\n    }\n\n    // list\n    if (cap = this.rules.list.exec(src)) {\n      src = src.substring(cap[0].length);\n      bull = cap[2];\n\n      this.tokens.push({\n        type: 'list_start',\n        ordered: bull.length > 1\n      });\n\n      // Get each top-level item.\n      cap = cap[0].match(this.rules.item);\n\n      next = false;\n      l = cap.length;\n      i = 0;\n\n      for (; i < l; i++) {\n        item = cap[i];\n\n        // Remove the list item's bullet\n        // so it is seen as the next token.\n        space = item.length;\n        item = item.replace(/^ *([*+-]|\\d+\\.) +/, '');\n\n        // Outdent whatever the\n        // list item contains. Hacky.\n        if (~item.indexOf('\\n ')) {\n          space -= item.length;\n          item = !this.options.pedantic\n            ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')\n            : item.replace(/^ {1,4}/gm, '');\n        }\n\n        // Determine whether the next list item belongs here.\n        // Backpedal if it does not belong in this list.\n        if (this.options.smartLists && i !== l - 1) {\n          b = block.bullet.exec(cap[i + 1])[0];\n          if (bull !== b && !(bull.length > 1 && b.length > 1)) {\n            src = cap.slice(i + 1).join('\\n') + src;\n            i = l - 1;\n          }\n        }\n\n        // Determine whether item is loose or not.\n        // Use: /(^|\\n)(?! )[^\\n]+\\n\\n(?!\\s*$)/\n        // for discount behavior.\n        loose = next || /\\n\\n(?!\\s*$)/.test(item);\n        if (i !== l - 1) {\n          next = item.charAt(item.length - 1) === '\\n';\n          if (!loose) loose = next;\n        }\n\n        this.tokens.push({\n          type: loose\n            ? 'loose_item_start'\n            : 'list_item_start'\n        });\n\n        // Recurse.\n        this.token(item, false);\n\n        this.tokens.push({\n          type: 'list_item_end'\n        });\n      }\n\n      this.tokens.push({\n        type: 'list_end'\n      });\n\n      continue;\n    }\n\n    // html\n    if (cap = this.rules.html.exec(src)) {\n      src = src.substring(cap[0].length);\n      this.tokens.push({\n        type: this.options.sanitize\n          ? 'paragraph'\n          : 'html',\n        pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style',\n        text: cap[0]\n      });\n      continue;\n    }\n\n    // def\n    if (top && (cap = this.rules.def.exec(src))) {\n      src = src.substring(cap[0].length);\n      this.tokens.links[cap[1].toLowerCase()] = {\n        href: cap[2],\n        title: cap[3]\n      };\n      continue;\n    }\n\n    // table (gfm)\n    if (top && (cap = this.rules.table.exec(src))) {\n      src = src.substring(cap[0].length);\n\n      item = {\n        type: 'table',\n        header: cap[1].replace(/^ *| *\\| *$/g, '').split(/ *\\| */),\n        align: cap[2].replace(/^ *|\\| *$/g, '').split(/ *\\| */),\n        cells: cap[3].replace(/(?: *\\| *)?\\n$/, '').split('\\n')\n      };\n\n      for (i = 0; i < item.align.length; i++) {\n        if (/^ *-+: *$/.test(item.align[i])) {\n          item.align[i] = 'right';\n        } else if (/^ *:-+: *$/.test(item.align[i])) {\n          item.align[i] = 'center';\n        } else if (/^ *:-+ *$/.test(item.align[i])) {\n          item.align[i] = 'left';\n        } else {\n          item.align[i] = null;\n        }\n      }\n\n      for (i = 0; i < item.cells.length; i++) {\n        item.cells[i] = item.cells[i]\n          .replace(/^ *\\| *| *\\| *$/g, '')\n          .split(/ *\\| */);\n      }\n\n      this.tokens.push(item);\n\n      continue;\n    }\n\n    // top-level paragraph\n    if (top && (cap = this.rules.paragraph.exec(src))) {\n      src = src.substring(cap[0].length);\n      this.tokens.push({\n        type: 'paragraph',\n        text: cap[1].charAt(cap[1].length - 1) === '\\n'\n          ? cap[1].slice(0, -1)\n          : cap[1]\n      });\n      continue;\n    }\n\n    // text\n    if (cap = this.rules.text.exec(src)) {\n      // Top-level should never reach here.\n      src = src.substring(cap[0].length);\n      this.tokens.push({\n        type: 'text',\n        text: cap[0]\n      });\n      continue;\n    }\n\n    if (src) {\n      throw new\n        Error('Infinite loop on byte: ' + src.charCodeAt(0));\n    }\n  }\n\n  return this.tokens;\n};\n\n/**\n * Inline-Level Grammar\n */\n\nvar inline = {\n  escape: /^\\\\([\\\\`*{}\\[\\]()#+\\-.!_>])/,\n  autolink: /^<([^ >]+(@|:\\/)[^ >]+)>/,\n  url: noop,\n  tag: /^<!--[\\s\\S]*?-->|^<\\/?\\w+(?:\"[^\"]*\"|'[^']*'|[^'\">])*?>/,\n  link: /^!?\\[(inside)\\]\\(href\\)/,\n  reflink: /^!?\\[(inside)\\]\\s*\\[([^\\]]*)\\]/,\n  nolink: /^!?\\[((?:\\[[^\\]]*\\]|[^\\[\\]])*)\\]/,\n  strong: /^__([\\s\\S]+?)__(?!_)|^\\*\\*([\\s\\S]+?)\\*\\*(?!\\*)/,\n  em: /^\\b_((?:__|[\\s\\S])+?)_\\b|^\\*((?:\\*\\*|[\\s\\S])+?)\\*(?!\\*)/,\n  code: /^(`+)\\s*([\\s\\S]*?[^`])\\s*\\1(?!`)/,\n  br: /^ {2,}\\n(?!\\s*$)/,\n  del: noop,\n  text: /^[\\s\\S]+?(?=[\\\\<!\\[_*`]| {2,}\\n|$)/\n};\n\ninline._inside = /(?:\\[[^\\]]*\\]|[^\\[\\]]|\\](?=[^\\[]*\\]))*/;\ninline._href = /\\s*<?([\\s\\S]*?)>?(?:\\s+['\"]([\\s\\S]*?)['\"])?\\s*/;\n\ninline.link = replace(inline.link)\n  ('inside', inline._inside)\n  ('href', inline._href)\n  ();\n\ninline.reflink = replace(inline.reflink)\n  ('inside', inline._inside)\n  ();\n\n/**\n * Normal Inline Grammar\n */\n\ninline.normal = merge({}, inline);\n\n/**\n * Pedantic Inline Grammar\n */\n\ninline.pedantic = merge({}, inline.normal, {\n  strong: /^__(?=\\S)([\\s\\S]*?\\S)__(?!_)|^\\*\\*(?=\\S)([\\s\\S]*?\\S)\\*\\*(?!\\*)/,\n  em: /^_(?=\\S)([\\s\\S]*?\\S)_(?!_)|^\\*(?=\\S)([\\s\\S]*?\\S)\\*(?!\\*)/\n});\n\n/**\n * GFM Inline Grammar\n */\n\ninline.gfm = merge({}, inline.normal, {\n  escape: replace(inline.escape)('])', '~|])')(),\n  url: /^(https?:\\/\\/[^\\s<]+[^<.,:;\"')\\]\\s])/,\n  del: /^~~(?=\\S)([\\s\\S]*?\\S)~~/,\n  text: replace(inline.text)\n    (']|', '~]|')\n    ('|', '|https?://|')\n    ()\n});\n\n/**\n * GFM + Line Breaks Inline Grammar\n */\n\ninline.breaks = merge({}, inline.gfm, {\n  br: replace(inline.br)('{2,}', '*')(),\n  text: replace(inline.gfm.text)('{2,}', '*')()\n});\n\n/**\n * Inline Lexer & Compiler\n */\n\nfunction InlineLexer(links, options) {\n  this.options = options || marked.defaults;\n  this.links = links;\n  this.rules = inline.normal;\n\n  if (!this.links) {\n    throw new\n      Error('Tokens array requires a `links` property.');\n  }\n\n  if (this.options.gfm) {\n    if (this.options.breaks) {\n      this.rules = inline.breaks;\n    } else {\n      this.rules = inline.gfm;\n    }\n  } else if (this.options.pedantic) {\n    this.rules = inline.pedantic;\n  }\n}\n\n/**\n * Expose Inline Rules\n */\n\nInlineLexer.rules = inline;\n\n/**\n * Static Lexing/Compiling Method\n */\n\nInlineLexer.output = function(src, links, options) {\n  var inline = new InlineLexer(links, options);\n  return inline.output(src);\n};\n\n/**\n * Lexing/Compiling\n */\n\nInlineLexer.prototype.output = function(src) {\n  var out = ''\n    , link\n    , text\n    , href\n    , cap;\n\n  while (src) {\n    // escape\n    if (cap = this.rules.escape.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += cap[1];\n      continue;\n    }\n\n    // autolink\n    if (cap = this.rules.autolink.exec(src)) {\n      src = src.substring(cap[0].length);\n      if (cap[2] === '@') {\n        text = cap[1].charAt(6) === ':'\n          ? this.mangle(cap[1].substring(7))\n          : this.mangle(cap[1]);\n        href = this.mangle('mailto:') + text;\n      } else {\n        text = escape(cap[1]);\n        href = text;\n      }\n      out += '<a href=\"'\n        + href\n        + '\">'\n        + text\n        + '</a>';\n      continue;\n    }\n\n    // url (gfm)\n    if (cap = this.rules.url.exec(src)) {\n      src = src.substring(cap[0].length);\n      text = escape(cap[1]);\n      href = text;\n      out += '<a href=\"'\n        + href\n        + '\">'\n        + text\n        + '</a>';\n      continue;\n    }\n\n    // tag\n    if (cap = this.rules.tag.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += this.options.sanitize\n        ? escape(cap[0])\n        : cap[0];\n      continue;\n    }\n\n    // link\n    if (cap = this.rules.link.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += this.outputLink(cap, {\n        href: cap[2],\n        title: cap[3]\n      });\n      continue;\n    }\n\n    // reflink, nolink\n    if ((cap = this.rules.reflink.exec(src))\n        || (cap = this.rules.nolink.exec(src))) {\n      src = src.substring(cap[0].length);\n      link = (cap[2] || cap[1]).replace(/\\s+/g, ' ');\n      link = this.links[link.toLowerCase()];\n      if (!link || !link.href) {\n        out += cap[0].charAt(0);\n        src = cap[0].substring(1) + src;\n        continue;\n      }\n      out += this.outputLink(cap, link);\n      continue;\n    }\n\n    // strong\n    if (cap = this.rules.strong.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += '<strong>'\n        + this.output(cap[2] || cap[1])\n        + '</strong>';\n      continue;\n    }\n\n    // em\n    if (cap = this.rules.em.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += '<em>'\n        + this.output(cap[2] || cap[1])\n        + '</em>';\n      continue;\n    }\n\n    // code\n    if (cap = this.rules.code.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += '<code>'\n        + escape(cap[2], true)\n        + '</code>';\n      continue;\n    }\n\n    // br\n    if (cap = this.rules.br.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += '<br>';\n      continue;\n    }\n\n    // del (gfm)\n    if (cap = this.rules.del.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += '<del>'\n        + this.output(cap[1])\n        + '</del>';\n      continue;\n    }\n\n    // text\n    if (cap = this.rules.text.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += escape(this.smartypants(cap[0]));\n      continue;\n    }\n\n    if (src) {\n      throw new\n        Error('Infinite loop on byte: ' + src.charCodeAt(0));\n    }\n  }\n\n  return out;\n};\n\n/**\n * Compile Link\n */\n\nInlineLexer.prototype.outputLink = function(cap, link) {\n  if (cap[0].charAt(0) !== '!') {\n    return '<a href=\"'\n      + escape(link.href)\n      + '\"'\n      + (link.title\n      ? ' title=\"'\n      + escape(link.title)\n      + '\"'\n      : '')\n      + '>'\n      + this.output(cap[1])\n      + '</a>';\n  } else {\n    return '<img src=\"'\n      + escape(link.href)\n      + '\" alt=\"'\n      + escape(cap[1])\n      + '\"'\n      + (link.title\n      ? ' title=\"'\n      + escape(link.title)\n      + '\"'\n      : '')\n      + '>';\n  }\n};\n\n/**\n * Smartypants Transformations\n */\n\nInlineLexer.prototype.smartypants = function(text) {\n  if (!this.options.smartypants) return text;\n  return text\n    // em-dashes\n    .replace(/--/g, '\\u2014')\n    // opening singles\n    .replace(/(^|[-\\u2014/(\\[{\"\\s])'/g, '$1\\u2018')\n    // closing singles & apostrophes\n    .replace(/'/g, '\\u2019')\n    // opening doubles\n    .replace(/(^|[-\\u2014/(\\[{\\u2018\\s])\"/g, '$1\\u201c')\n    // closing doubles\n    .replace(/\"/g, '\\u201d')\n    // ellipses\n    .replace(/\\.{3}/g, '\\u2026');\n};\n\n/**\n * Mangle Links\n */\n\nInlineLexer.prototype.mangle = function(text) {\n  var out = ''\n    , l = text.length\n    , i = 0\n    , ch;\n\n  for (; i < l; i++) {\n    ch = text.charCodeAt(i);\n    if (Math.random() > 0.5) {\n      ch = 'x' + ch.toString(16);\n    }\n    out += '&#' + ch + ';';\n  }\n\n  return out;\n};\n\n/**\n * Parsing & Compiling\n */\n\nfunction Parser(options) {\n  this.tokens = [];\n  this.token = null;\n  this.options = options || marked.defaults;\n}\n\n/**\n * Static Parse Method\n */\n\nParser.parse = function(src, options) {\n  var parser = new Parser(options);\n  return parser.parse(src);\n};\n\n/**\n * Parse Loop\n */\n\nParser.prototype.parse = function(src) {\n  this.inline = new InlineLexer(src.links, this.options);\n  this.tokens = src.reverse();\n\n  var out = '';\n  while (this.next()) {\n    out += this.tok();\n  }\n\n  return out;\n};\n\n/**\n * Next Token\n */\n\nParser.prototype.next = function() {\n  return this.token = this.tokens.pop();\n};\n\n/**\n * Preview Next Token\n */\n\nParser.prototype.peek = function() {\n  return this.tokens[this.tokens.length - 1] || 0;\n};\n\n/**\n * Parse Text Tokens\n */\n\nParser.prototype.parseText = function() {\n  var body = this.token.text;\n\n  while (this.peek().type === 'text') {\n    body += '\\n' + this.next().text;\n  }\n\n  return this.inline.output(body);\n};\n\n/**\n * Parse Current Token\n */\n\nParser.prototype.tok = function() {\n  switch (this.token.type) {\n    case 'space': {\n      return '';\n    }\n    case 'hr': {\n      return '<hr>\\n';\n    }\n    case 'heading': {\n      return '<h'\n        + this.token.depth\n        + ' id=\"'\n        + this.token.text.toLowerCase().replace(/[^\\w]+/g, '-')\n        + '\">'\n        + this.inline.output(this.token.text)\n        + '</h'\n        + this.token.depth\n        + '>\\n';\n    }\n    case 'code': {\n      if (this.options.highlight) {\n        var code = this.options.highlight(this.token.text, this.token.lang);\n        if (code != null && code !== this.token.text) {\n          this.token.escaped = true;\n          this.token.text = code;\n        }\n      }\n\n      if (!this.token.escaped) {\n        this.token.text = escape(this.token.text, true);\n      }\n\n      return '<pre><code'\n        + (this.token.lang\n        ? ' class=\"'\n        + this.options.langPrefix\n        + this.token.lang\n        + '\"'\n        : '')\n        + '>'\n        + this.token.text\n        + '</code></pre>\\n';\n    }\n    case 'table': {\n      var body = ''\n        , heading\n        , i\n        , row\n        , cell\n        , j;\n\n      // header\n      body += '<thead>\\n<tr>\\n';\n      for (i = 0; i < this.token.header.length; i++) {\n        heading = this.inline.output(this.token.header[i]);\n        body += '<th';\n        if (this.token.align[i]) {\n          body += ' style=\"text-align:' + this.token.align[i] + '\"';\n        }\n        body += '>' + heading + '</th>\\n';\n      }\n      body += '</tr>\\n</thead>\\n';\n\n      // body\n      body += '<tbody>\\n'\n      for (i = 0; i < this.token.cells.length; i++) {\n        row = this.token.cells[i];\n        body += '<tr>\\n';\n        for (j = 0; j < row.length; j++) {\n          cell = this.inline.output(row[j]);\n          body += '<td';\n          if (this.token.align[j]) {\n            body += ' style=\"text-align:' + this.token.align[j] + '\"';\n          }\n          body += '>' + cell + '</td>\\n';\n        }\n        body += '</tr>\\n';\n      }\n      body += '</tbody>\\n';\n\n      return '<table>\\n'\n        + body\n        + '</table>\\n';\n    }\n    case 'blockquote_start': {\n      var body = '';\n\n      while (this.next().type !== 'blockquote_end') {\n        body += this.tok();\n      }\n\n      return '<blockquote>\\n'\n        + body\n        + '</blockquote>\\n';\n    }\n    case 'list_start': {\n      var type = this.token.ordered ? 'ol' : 'ul'\n        , body = '';\n\n      while (this.next().type !== 'list_end') {\n        body += this.tok();\n      }\n\n      return '<'\n        + type\n        + '>\\n'\n        + body\n        + '</'\n        + type\n        + '>\\n';\n    }\n    case 'list_item_start': {\n      var body = '';\n\n      while (this.next().type !== 'list_item_end') {\n        body += this.token.type === 'text'\n          ? this.parseText()\n          : this.tok();\n      }\n\n      return '<li>'\n        + body\n        + '</li>\\n';\n    }\n    case 'loose_item_start': {\n      var body = '';\n\n      while (this.next().type !== 'list_item_end') {\n        body += this.tok();\n      }\n\n      return '<li>'\n        + body\n        + '</li>\\n';\n    }\n    case 'html': {\n      return !this.token.pre && !this.options.pedantic\n        ? this.inline.output(this.token.text)\n        : this.token.text;\n    }\n    case 'paragraph': {\n      return '<p>'\n        + this.inline.output(this.token.text)\n        + '</p>\\n';\n    }\n    case 'text': {\n      return '<p>'\n        + this.parseText()\n        + '</p>\\n';\n    }\n  }\n};\n\n/**\n * Helpers\n */\n\nfunction escape(html, encode) {\n  return html\n    .replace(!encode ? /&(?!#?\\w+;)/g : /&/g, '&amp;')\n    .replace(/</g, '&lt;')\n    .replace(/>/g, '&gt;')\n    .replace(/\"/g, '&quot;')\n    .replace(/'/g, '&#39;');\n}\n\nfunction replace(regex, opt) {\n  regex = regex.source;\n  opt = opt || '';\n  return function self(name, val) {\n    if (!name) return new RegExp(regex, opt);\n    val = val.source || val;\n    val = val.replace(/(^|[^\\[])\\^/g, '$1');\n    regex = regex.replace(name, val);\n    return self;\n  };\n}\n\nfunction noop() {}\nnoop.exec = noop;\n\nfunction merge(obj) {\n  var i = 1\n    , target\n    , key;\n\n  for (; i < arguments.length; i++) {\n    target = arguments[i];\n    for (key in target) {\n      if (Object.prototype.hasOwnProperty.call(target, key)) {\n        obj[key] = target[key];\n      }\n    }\n  }\n\n  return obj;\n}\n\n/**\n * Marked\n */\n\nfunction marked(src, opt, callback) {\n  if (callback || typeof opt === 'function') {\n    if (!callback) {\n      callback = opt;\n      opt = null;\n    }\n\n    opt = merge({}, marked.defaults, opt || {});\n\n    var highlight = opt.highlight\n      , tokens\n      , pending\n      , i = 0;\n\n    try {\n      tokens = Lexer.lex(src, opt)\n    } catch (e) {\n      return callback(e);\n    }\n\n    pending = tokens.length;\n\n    var done = function() {\n      var out, err;\n\n      try {\n        out = Parser.parse(tokens, opt);\n      } catch (e) {\n        err = e;\n      }\n\n      opt.highlight = highlight;\n\n      return err\n        ? callback(err)\n        : callback(null, out);\n    };\n\n    if (!highlight || highlight.length < 3) {\n      return done();\n    }\n\n    delete opt.highlight;\n\n    if (!pending) return done();\n\n    for (; i < tokens.length; i++) {\n      (function(token) {\n        if (token.type !== 'code') {\n          return --pending || done();\n        }\n        return highlight(token.text, token.lang, function(err, code) {\n          if (code == null || code === token.text) {\n            return --pending || done();\n          }\n          token.text = code;\n          token.escaped = true;\n          --pending || done();\n        });\n      })(tokens[i]);\n    }\n\n    return;\n  }\n  try {\n    if (opt) opt = merge({}, marked.defaults, opt);\n    return Parser.parse(Lexer.lex(src, opt), opt);\n  } catch (e) {\n    e.message += '\\nPlease report this to https://github.com/chjj/marked.';\n    if ((opt || marked.defaults).silent) {\n      return '<p>An error occured:</p><pre>'\n        + escape(e.message + '', true)\n        + '</pre>';\n    }\n    throw e;\n  }\n}\n\n/**\n * Options\n */\n\nmarked.options =\nmarked.setOptions = function(opt) {\n  merge(marked.defaults, opt);\n  return marked;\n};\n\nmarked.defaults = {\n  gfm: true,\n  tables: true,\n  breaks: false,\n  pedantic: false,\n  sanitize: false,\n  smartLists: false,\n  silent: false,\n  highlight: null,\n  langPrefix: 'lang-',\n  smartypants: false\n};\n\n/**\n * Expose\n */\n\nmarked.Parser = Parser;\nmarked.parser = Parser.parse;\n\nmarked.Lexer = Lexer;\nmarked.lexer = Lexer.lex;\n\nmarked.InlineLexer = InlineLexer;\nmarked.inlineLexer = InlineLexer.output;\n\nmarked.parse = marked;\n\nif (typeof exports === 'object') {\n  module.exports = marked;\n} else if (typeof define === 'function' && define.amd) {\n  define(function() { return marked; });\n} else {\n  this.marked = marked;\n}\n\n}).call(function() {\n  return this || (typeof window !== 'undefined' ? window : global);\n}());\n",
          "type": "blob"
        },
        "main.coffee.md": {
          "path": "main.coffee.md",
          "mode": "100644",
          "content": "Like a Doctor\n=============\n\nDocument all of your literate code: files that end in `.md`.\n\nInspired by Docco. Designed for the browser environment.\n\nWe use marked for generating the markdown.\n\n    marked = require \"./lib/marked\"\n    highlight = require \"./lib/highlight\"\n    languages = require \"./languages\"\n\n    marked.setOptions\n      highlight: (code, lang) ->\n        if highlight.LANGUAGES[lang]\n          highlight.highlight(lang, code).value\n        else\n          console.warn \"couldn't highlight code block with unknown language '#{lang}'\"\n\n          code\n\nExport our public api.\n\n    module.exports = doctor =\n      parse: require('./parse')\n\nOur docco style template.\n\n      template: require('./template')\n\nDocument one file.\n\n      compile: (content, language=\"coffeescript\") ->\n        doctor.parse(content).map ({text, code}) ->\n          docsHtml: marked(text)\n          codeHtml: marked \"```#{language}\\n#{code}\\n```\"\n\nGenerate the documentation for all files within the given package. Returns a\npromise that will be fulfilled with an array of `fileData`.\n\n      documentAll: (pkg) ->\n        {entryPoint, source, repository} = pkg\n        {branch, default_branch} = repository\n\n        if branch is \"blog\" # HACK\n          base = \"\"\n        else if branch is default_branch\n          base = \"docs/\"\n        else\n          base = \"#{branch}/docs/\"\n\n        documentableFiles = Object.keys(source).select (name) ->\n          name.extension() is \"md\"\n\n        results = documentableFiles.map (name) ->\n          language = name.withoutExtension().extension()\n          language = languages[language] || language\n\n          doctor.compile source[name].content, language\n\n        extras = [packageScript(base, pkg)]\n\n        scripts = dependencyScripts unique([\n          \"https://code.jquery.com/jquery-1.10.1.min.js\"\n          \"https://cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js\"\n          \"http://www.danielx.net/require/v0.2.2.js\"\n        ].concat(\n          pkg.remoteDependencies or []\n        ))\n\n        # Add interactive loader to scripts string\n        scripts += interactiveLoader\n\n        results = results.map (result, i) ->\n          # Assuming .*.md so we should strip the extension twice\n          name = documentableFiles[i].withoutExtension().withoutExtension()\n\n          content = doctor.template\n            title: name\n            sections: result\n            scripts:  \"#{scripts}#{makeScript(relativeScriptPath(name))}\"\n\n          # Add an index.html if our file is the entry point\n          if name is entryPoint\n            extras.push\n              content: content\n              mode: \"100644\"\n              path: \"#{base}index.html\"\n              type: \"blob\"\n\n          content: content\n          mode: \"100644\"\n          path: \"#{base}#{name}.html\"\n          type: \"blob\"\n\n        Deferred().resolve(extras.concat(results))\n\nHelpers\n-------\n\n    interactiveLoader =\n      \"\"\"\n        <script>\n          $.ajax({\n            url: \"http://strd6.github.io/interactive/v0.8.1.jsonp\",\n            dataType: \"jsonp\",\n            jsonpCallback: \"STRd6/interactive:v0.8.1\",\n            cache: true\n          }).then(function(PACKAGE) {\n            Require.generateFor(PACKAGE)(\"./\" + PACKAGE.entryPoint)\n          })\n        <\\/script>\n      \"\"\"\n\n`makeScript` returns a string representation of a script tag that has a src\nattribute.\n\n    makeScript = (src) ->\n      script = document.createElement(\"script\")\n      script.src = src\n\n      return script.outerHTML\n\n`dependencyScripts` returns a string containing the script tags that are\nthe dependencies of this build.\n\n    dependencyScripts = (remoteDependencies=[]) ->\n      remoteDependencies.map(makeScript).join(\"\\n\")\n\n`unique` returns a new duplicate free version of an array.\n\n    unique = (array) ->\n      array.reduce (results, item) ->\n        results.push item if results.indexOf(item) is -1\n\n        results\n      , []\n\nThis returns a script file that exposes a global `require` that gives access to\nthe current package and is meant to be included in every docs page.\n\n    packageScript = (base, pkg) ->\n      content: \"\"\"\n        (function(pkg) {\n          // Expose a require for our package so scripts can access our modules\n          window.require = Require.generateFor(pkg);\n        })(#{JSON.stringify(pkg, null, 2)});\n      \"\"\"\n      mode: \"100644\"\n      path: \"#{base}package.js\"\n      type: \"blob\"\n\nPackage Script path\n\n    relativeScriptPath = (path) ->\n      upOne = \"../\"\n      results = []\n\n      (path.split(\"/\").length - 1).times ->\n        results.push upOne\n\n      results.concat(\"package.js\").join(\"\")\n",
          "type": "blob"
        },
        "parse.coffee.md": {
          "path": "parse.coffee.md",
          "mode": "100644",
          "content": "Parse\n=====\n\nParse a Markdown document into an array of sections that contain code and text.\n\nImplementation\n--------------\n\nRegExes for detecting indentation, blank lines, and section breaks.\n\n    indent = /^([ ]{4}|\\t)/\n    blank = /^\\s*$/\n    sectionBreak = /^(---+|===+)$/\n\nParsing converts a string of Markdown text into an array of sections.\n\n    parse = (source) ->\n\nA helper to create section objects. Each section contains text and code.\n\n      Section = ->\n        text: []\n        code: []\n\nOur array of sections that we will return.\n\n      sections = [Section()]\n\nA helper to get the last section in the array.\n\n      lastSection = ->\n        sections.last()\n\nWhenever we encounter code we push it onto the last section.\n\n      pushCode = (code) ->\n        lastSection().code.push code\n\nPushing text is a little bit more complicated. If the last section has code in\nit then we need to push a new section on and add the text to that.\n\nIf the last section is doesn't have any code yet we can push our text onto it.\n\nIf our text matches a `sectionbreak` then we push a new section after adding\nour text to the previous section.\n\n      pushText = (text) ->\n        if lastSection().code.length\n          section = Section()\n          section.text.push text\n          sections.push section\n        else\n          lastSection().text.push text\n\n          sections.push Section() if sectionBreak.test text\n\n      pushEmpty = ->\n        if lastWasCode\n          pushCode(\"\")\n        else\n          lastSection().text.push \"\"\n\n      lastWasCode = false\n\n      source.split(\"\\n\").each (line) ->\n        if blank.exec(line)\n          pushEmpty()\n        else if match = indent.exec(line)\n          lastWasCode = true\n          pushCode line[match[0].length..]\n        else\n          lastWasCode = false\n          pushText line\n\n      sections.each (section) ->\n        section.text = truncateEmpties(section.text).join(\"\\n\")\n        section.code = truncateEmpties(section.code).join(\"\\n\")\n\n    module.exports = parse\n\nHelpers\n-------\n\nThis helper removes empty strings from the end of our text and code arrays so\nwe're not left with extra newlines and things in between sections.\n\n    truncateEmpties = (array) ->\n      while (last = array.last())? and last is \"\"\n        array.pop()\n\n      return array\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "version: \"0.3.2\"\nremoteDependencies: [\n  \"https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.5.2/underscore-min.js\"\n  \"http://www.danielx.net/tempest/javascripts/envweb.js\"\n]\n",
          "type": "blob"
        },
        "template.coffee.md": {
          "path": "template.coffee.md",
          "mode": "100644",
          "content": "\nStole the template from Docco parallel style.\n\n    template = _.template \"\"\"\n      <!DOCTYPE html>\n\n      <html>\n      <head>\n        <title><%= title %></title>\n        <meta http-equiv=\"content-type\" content=\"text/html; charset=UTF-8\">\n        <meta name=\"viewport\" content=\"width=device-width, target-densitydpi=160dpi, initial-scale=1.0; maximum-scale=1.0; user-scalable=0;\">\n        <link rel=\"stylesheet\" media=\"all\" href=\"http://strd6.github.io/cdn/parallel/docco.css\" />\n      </head>\n      <body>\n        <div id=\"container\">\n          <div id=\"background\"></div>\n          <ul class=\"sections\">\n              <% for (var i=0, l=sections.length; i<l; i++) { %>\n              <% var section = sections[i]; %>\n              <li id=\"section-<%= i + 1 %>\">\n                  <div class=\"annotation\">\n                    <div class=\"pilwrap\">\n                      <a class=\"pilcrow\" href=\"#section-<%= i + 1 %>\">&#182;</a>\n                    </div>\n                    <%= section.docsHtml %>\n                  </div>\n                  <div class=\"content\"><%= section.codeHtml %></div>\n              </li>\n              <% } %>\n          </ul>\n        </div>\n        <%= scripts %>\n      </body>\n      </html>\n    \"\"\"\n\n    module.exports = template\n",
          "type": "blob"
        },
        "test/languages.coffee": {
          "path": "test/languages.coffee",
          "mode": "100644",
          "content": "languages = require \"../languages\"\n\ndescribe \"languages\", ->\n  it \"should know of coffeescript and javascript\", ->\n    assert languages.js is \"javascript\"\n    assert languages.coffee is \"coffeescript\"\n",
          "type": "blob"
        },
        "test/main.coffee": {
          "path": "test/main.coffee",
          "mode": "100644",
          "content": "md = require \"../main\"\nmarked = require \"../lib/marked\"\nhighlight = require \"../lib/highlight\"\n\ndescribe \"marked markdown generation\", ->\n  it \"should compile markdown\", ->\n    assert marked 'I am using __markdown__.'\n\ndescribe \"hightlight.js\", ->\n  it \"highlight stuff\", ->\n    assert highlight\n\ndescribe \"Parsing\", ->\n  it \"should return an array of sections\", ->\n    sections = md.parse \"\"\"\n      A sample text + code section\n\n          I'm the code\n    \"\"\"\n\n    assert sections.length is 1\n    assert sections.first().text is \"A sample text + code section\"\n    assert sections.first().code is \"I'm the code\"\n\ndescribe \"Stuff spanning multiple lines\", ->\n  it \"should be split by newline characters\", ->\n    sections = md.parse \"\"\"\n      1\n      2\n      3\n\n          Code1\n          Code2\n    \"\"\"\n\n    assert sections.length is 1\n    assert sections.first().text is \"1\\n2\\n3\"\n    assert sections.first().code is \"Code1\\nCode2\"\n\ndescribe \"A normal markdown paragraph\", ->\n  it \"should keep newlines within\", ->\n    sections = md.parse \"\"\"\n      I'm talking about stuff.\n      \n      Paragraph two is rad!\n    \"\"\"\n    \n    assert sections.first().text.match(\"\\n\\n\")\n\ndescribe \"Headers\", ->\n  it \"should split sections\", ->\n    sections = md.parse \"\"\"\n      Intro\n      -----\n      \n      Some other stuff\n    \"\"\"\n    \n    assert sections.length is 2\n\ndescribe \"Many code text sequences\", ->\n  it \"should add text in new sections after code\", ->\n    sections = md.parse \"\"\"\n      Some description\n\n          Code\n\n      Another description\n\n          More code\n\n      Hey\n    \"\"\"\n    \n    assert sections.length is 3\n\ndescribe \"documenting a file\", ->\n  it \"should be 2legit\", ->\n    assert md.compile(\"Hey\")\n\ndescribe \"documenting a file package\", ->\n  it \"should be 2legit\", (done) ->\n    md.documentAll(\n      repository:\n        branch: \"master\"\n        default_branch: \"master\"\n      entryPoint: \"main\"\n      source:\n        \"main.coffee.md\": \n          content: \"Yolo is a lifestyle choice\\n    alert 'wat'\"\n    ).then (results) ->\n      done()\n",
          "type": "blob"
        },
        "test/template.coffee": {
          "path": "test/template.coffee",
          "mode": "100644",
          "content": "template = require \"../template\"\n\ndescribe \"template\", ->\n  it \"should exist\", ->\n    assert template\n\n  it \"should render html when given a title and sections\", ->\n    result = template\n      scripts: \"\"\n      title: \"Test\"\n      sections: [\n        docsHtml: \"<h1>Hello</h1>\"\n        codeHtml: \"<pre>1 + 1 == 2</pre>\"\n      ]\n\n    assert result\n",
          "type": "blob"
        }
      },
      "distribution": {
        "languages": {
          "path": "languages",
          "content": "module.exports = {\"coffee\":\"coffeescript\",\"js\":\"javascript\"};",
          "type": "blob"
        },
        "lib/highlight": {
          "path": "lib/highlight",
          "content": "var hljs=new function(){function l(o){return o.replace(/&/gm,\"&amp;\").replace(/</gm,\"&lt;\").replace(/>/gm,\"&gt;\")}function b(p){for(var o=p.firstChild;o;o=o.nextSibling){if(o.nodeName==\"CODE\"){return o}if(!(o.nodeType==3&&o.nodeValue.match(/\\s+/))){break}}}function h(p,o){return Array.prototype.map.call(p.childNodes,function(q){if(q.nodeType==3){return o?q.nodeValue.replace(/\\n/g,\"\"):q.nodeValue}if(q.nodeName==\"BR\"){return\"\\n\"}return h(q,o)}).join(\"\")}function a(q){var p=(q.className+\" \"+q.parentNode.className).split(/\\s+/);p=p.map(function(r){return r.replace(/^language-/,\"\")});for(var o=0;o<p.length;o++){if(e[p[o]]||p[o]==\"no-highlight\"){return p[o]}}}function c(q){var o=[];(function p(r,s){for(var t=r.firstChild;t;t=t.nextSibling){if(t.nodeType==3){s+=t.nodeValue.length}else{if(t.nodeName==\"BR\"){s+=1}else{if(t.nodeType==1){o.push({event:\"start\",offset:s,node:t});s=p(t,s);o.push({event:\"stop\",offset:s,node:t})}}}}return s})(q,0);return o}function j(x,v,w){var p=0;var y=\"\";var r=[];function t(){if(x.length&&v.length){if(x[0].offset!=v[0].offset){return(x[0].offset<v[0].offset)?x:v}else{return v[0].event==\"start\"?x:v}}else{return x.length?x:v}}function s(A){function z(B){return\" \"+B.nodeName+'=\"'+l(B.value)+'\"'}return\"<\"+A.nodeName+Array.prototype.map.call(A.attributes,z).join(\"\")+\">\"}while(x.length||v.length){var u=t().splice(0,1)[0];y+=l(w.substr(p,u.offset-p));p=u.offset;if(u.event==\"start\"){y+=s(u.node);r.push(u.node)}else{if(u.event==\"stop\"){var o,q=r.length;do{q--;o=r[q];y+=(\"</\"+o.nodeName.toLowerCase()+\">\")}while(o!=u.node);r.splice(q,1);while(q<r.length){y+=s(r[q]);q++}}}}return y+l(w.substr(p))}function f(q){function o(s,r){return RegExp(s,\"m\"+(q.cI?\"i\":\"\")+(r?\"g\":\"\"))}function p(y,w){if(y.compiled){return}y.compiled=true;var s=[];if(y.k){var r={};function z(A,t){t.split(\" \").forEach(function(B){var C=B.split(\"|\");r[C[0]]=[A,C[1]?Number(C[1]):1];s.push(C[0])})}y.lR=o(y.l||hljs.IR,true);if(typeof y.k==\"string\"){z(\"keyword\",y.k)}else{for(var x in y.k){if(!y.k.hasOwnProperty(x)){continue}z(x,y.k[x])}}y.k=r}if(w){if(y.bWK){y.b=\"\\\\b(\"+s.join(\"|\")+\")\\\\s\"}y.bR=o(y.b?y.b:\"\\\\B|\\\\b\");if(!y.e&&!y.eW){y.e=\"\\\\B|\\\\b\"}if(y.e){y.eR=o(y.e)}y.tE=y.e||\"\";if(y.eW&&w.tE){y.tE+=(y.e?\"|\":\"\")+w.tE}}if(y.i){y.iR=o(y.i)}if(y.r===undefined){y.r=1}if(!y.c){y.c=[]}for(var v=0;v<y.c.length;v++){if(y.c[v]==\"self\"){y.c[v]=y}p(y.c[v],y)}if(y.starts){p(y.starts,w)}var u=[];for(var v=0;v<y.c.length;v++){u.push(y.c[v].b)}if(y.tE){u.push(y.tE)}if(y.i){u.push(y.i)}y.t=u.length?o(u.join(\"|\"),true):{exec:function(t){return null}}}p(q)}function d(D,E){function o(r,M){for(var L=0;L<M.c.length;L++){var K=M.c[L].bR.exec(r);if(K&&K.index==0){return M.c[L]}}}function s(K,r){if(K.e&&K.eR.test(r)){return K}if(K.eW){return s(K.parent,r)}}function t(r,K){return K.i&&K.iR.test(r)}function y(L,r){var K=F.cI?r[0].toLowerCase():r[0];return L.k.hasOwnProperty(K)&&L.k[K]}function G(){var K=l(w);if(!A.k){return K}var r=\"\";var N=0;A.lR.lastIndex=0;var L=A.lR.exec(K);while(L){r+=K.substr(N,L.index-N);var M=y(A,L);if(M){v+=M[1];r+='<span class=\"'+M[0]+'\">'+L[0]+\"</span>\"}else{r+=L[0]}N=A.lR.lastIndex;L=A.lR.exec(K)}return r+K.substr(N)}function z(){if(A.sL&&!e[A.sL]){return l(w)}var r=A.sL?d(A.sL,w):g(w);if(A.r>0){v+=r.keyword_count;B+=r.r}return'<span class=\"'+r.language+'\">'+r.value+\"</span>\"}function J(){return A.sL!==undefined?z():G()}function I(L,r){var K=L.cN?'<span class=\"'+L.cN+'\">':\"\";if(L.rB){x+=K;w=\"\"}else{if(L.eB){x+=l(r)+K;w=\"\"}else{x+=K;w=r}}A=Object.create(L,{parent:{value:A}});B+=L.r}function C(K,r){w+=K;if(r===undefined){x+=J();return 0}var L=o(r,A);if(L){x+=J();I(L,r);return L.rB?0:r.length}var M=s(A,r);if(M){if(!(M.rE||M.eE)){w+=r}x+=J();do{if(A.cN){x+=\"</span>\"}A=A.parent}while(A!=M.parent);if(M.eE){x+=l(r)}w=\"\";if(M.starts){I(M.starts,\"\")}return M.rE?0:r.length}if(t(r,A)){throw\"Illegal\"}w+=r;return r.length||1}var F=e[D];f(F);var A=F;var w=\"\";var B=0;var v=0;var x=\"\";try{var u,q,p=0;while(true){A.t.lastIndex=p;u=A.t.exec(E);if(!u){break}q=C(E.substr(p,u.index-p),u[0]);p=u.index+q}C(E.substr(p));return{r:B,keyword_count:v,value:x,language:D}}catch(H){if(H==\"Illegal\"){return{r:0,keyword_count:0,value:l(E)}}else{throw H}}}function g(s){var o={keyword_count:0,r:0,value:l(s)};var q=o;for(var p in e){if(!e.hasOwnProperty(p)){continue}var r=d(p,s);r.language=p;if(r.keyword_count+r.r>q.keyword_count+q.r){q=r}if(r.keyword_count+r.r>o.keyword_count+o.r){q=o;o=r}}if(q.language){o.second_best=q}return o}function i(q,p,o){if(p){q=q.replace(/^((<[^>]+>|\\t)+)/gm,function(r,v,u,t){return v.replace(/\\t/g,p)})}if(o){q=q.replace(/\\n/g,\"<br>\")}return q}function m(r,u,p){var v=h(r,p);var t=a(r);if(t==\"no-highlight\"){return}var w=t?d(t,v):g(v);t=w.language;var o=c(r);if(o.length){var q=document.createElement(\"pre\");q.innerHTML=w.value;w.value=j(o,c(q),v)}w.value=i(w.value,u,p);var s=r.className;if(!s.match(\"(\\\\s|^)(language-)?\"+t+\"(\\\\s|$)\")){s=s?(s+\" \"+t):t}r.innerHTML=w.value;r.className=s;r.result={language:t,kw:w.keyword_count,re:w.r};if(w.second_best){r.second_best={language:w.second_best.language,kw:w.second_best.keyword_count,re:w.second_best.r}}}function n(){if(n.called){return}n.called=true;Array.prototype.map.call(document.getElementsByTagName(\"pre\"),b).filter(Boolean).forEach(function(o){m(o,hljs.tabReplace)})}function k(){window.addEventListener(\"DOMContentLoaded\",n,false);window.addEventListener(\"load\",n,false)}var e={};this.LANGUAGES=e;this.highlight=d;this.highlightAuto=g;this.fixMarkup=i;this.highlightBlock=m;this.initHighlighting=n;this.initHighlightingOnLoad=k;this.IR=\"[a-zA-Z][a-zA-Z0-9_]*\";this.UIR=\"[a-zA-Z_][a-zA-Z0-9_]*\";this.NR=\"\\\\b\\\\d+(\\\\.\\\\d+)?\";this.CNR=\"(\\\\b0[xX][a-fA-F0-9]+|(\\\\b\\\\d+(\\\\.\\\\d*)?|\\\\.\\\\d+)([eE][-+]?\\\\d+)?)\";this.BNR=\"\\\\b(0b[01]+)\";this.RSR=\"!|!=|!==|%|%=|&|&&|&=|\\\\*|\\\\*=|\\\\+|\\\\+=|,|\\\\.|-|-=|/|/=|:|;|<|<<|<<=|<=|=|==|===|>|>=|>>|>>=|>>>|>>>=|\\\\?|\\\\[|\\\\{|\\\\(|\\\\^|\\\\^=|\\\\||\\\\|=|\\\\|\\\\||~\";this.BE={b:\"\\\\\\\\[\\\\s\\\\S]\",r:0};this.ASM={cN:\"string\",b:\"'\",e:\"'\",i:\"\\\\n\",c:[this.BE],r:0};this.QSM={cN:\"string\",b:'\"',e:'\"',i:\"\\\\n\",c:[this.BE],r:0};this.CLCM={cN:\"comment\",b:\"//\",e:\"$\"};this.CBLCLM={cN:\"comment\",b:\"/\\\\*\",e:\"\\\\*/\"};this.HCM={cN:\"comment\",b:\"#\",e:\"$\"};this.NM={cN:\"number\",b:this.NR,r:0};this.CNM={cN:\"number\",b:this.CNR,r:0};this.BNM={cN:\"number\",b:this.BNR,r:0};this.inherit=function(q,r){var o={};for(var p in q){o[p]=q[p]}if(r){for(var p in r){o[p]=r[p]}}return o}}();hljs.LANGUAGES.bash=function(a){var g=\"true false\";var e=\"if then else elif fi for break continue while in do done echo exit return set declare\";var c={cN:\"variable\",b:\"\\\\$[a-zA-Z0-9_#]+\"};var b={cN:\"variable\",b:\"\\\\${([^}]|\\\\\\\\})+}\"};var h={cN:\"string\",b:'\"',e:'\"',i:\"\\\\n\",c:[a.BE,c,b],r:0};var d={cN:\"string\",b:\"'\",e:\"'\",c:[{b:\"''\"}],r:0};var f={cN:\"test_condition\",b:\"\",e:\"\",c:[h,d,c,b],k:{literal:g},r:0};return{k:{keyword:e,literal:g},c:[{cN:\"shebang\",b:\"(#!\\\\/bin\\\\/bash)|(#!\\\\/bin\\\\/sh)\",r:10},c,b,a.HCM,h,d,a.inherit(f,{b:\"\\\\[ \",e:\" \\\\]\",r:0}),a.inherit(f,{b:\"\\\\[\\\\[ \",e:\" \\\\]\\\\]\"})]}}(hljs);hljs.LANGUAGES.erlang=function(i){var c=\"[a-z'][a-zA-Z0-9_']*\";var o=\"(\"+c+\":\"+c+\"|\"+c+\")\";var f={keyword:\"after and andalso|10 band begin bnot bor bsl bzr bxor case catch cond div end fun let not of orelse|10 query receive rem try when xor\",literal:\"false true\"};var l={cN:\"comment\",b:\"%\",e:\"$\",r:0};var e={cN:\"number\",b:\"\\\\b(\\\\d+#[a-fA-F0-9]+|\\\\d+(\\\\.\\\\d+)?([eE][-+]?\\\\d+)?)\",r:0};var g={b:\"fun\\\\s+\"+c+\"/\\\\d+\"};var n={b:o+\"\\\\(\",e:\"\\\\)\",rB:true,r:0,c:[{cN:\"function_name\",b:o,r:0},{b:\"\\\\(\",e:\"\\\\)\",eW:true,rE:true,r:0}]};var h={cN:\"tuple\",b:\"{\",e:\"}\",r:0};var a={cN:\"variable\",b:\"\\\\b_([A-Z][A-Za-z0-9_]*)?\",r:0};var m={cN:\"variable\",b:\"[A-Z][a-zA-Z0-9_]*\",r:0};var b={b:\"#\",e:\"}\",i:\".\",r:0,rB:true,c:[{cN:\"record_name\",b:\"#\"+i.UIR,r:0},{b:\"{\",eW:true,r:0}]};var k={k:f,b:\"(fun|receive|if|try|case)\",e:\"end\"};k.c=[l,g,i.inherit(i.ASM,{cN:\"\"}),k,n,i.QSM,e,h,a,m,b];var j=[l,g,k,n,i.QSM,e,h,a,m,b];n.c[1].c=j;h.c=j;b.c[1].c=j;var d={cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",c:j};return{k:f,i:\"(</|\\\\*=|\\\\+=|-=|/=|/\\\\*|\\\\*/|\\\\(\\\\*|\\\\*\\\\))\",c:[{cN:\"function\",b:\"^\"+c+\"\\\\s*\\\\(\",e:\"->\",rB:true,i:\"\\\\(|#|//|/\\\\*|\\\\\\\\|:\",c:[d,{cN:\"title\",b:c}],starts:{e:\";|\\\\.\",k:f,c:j}},l,{cN:\"pp\",b:\"^-\",e:\"\\\\.\",r:0,eE:true,rB:true,l:\"-\"+i.IR,k:\"-module -record -undef -export -ifdef -ifndef -author -copyright -doc -vsn -import -include -include_lib -compile -define -else -endif -file -behaviour -behavior\",c:[d]},e,i.QSM,b,a,m,h]}}(hljs);hljs.LANGUAGES.cs=function(a){return{k:\"abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual volatile void while ascending descending from get group into join let orderby partial select set value var where yield\",c:[{cN:\"comment\",b:\"///\",e:\"$\",rB:true,c:[{cN:\"xmlDocTag\",b:\"///|<!--|-->\"},{cN:\"xmlDocTag\",b:\"</?\",e:\">\"}]},a.CLCM,a.CBLCLM,{cN:\"preprocessor\",b:\"#\",e:\"$\",k:\"if else elif endif define undef warning error line region endregion pragma checksum\"},{cN:\"string\",b:'@\"',e:'\"',c:[{b:'\"\"'}]},a.ASM,a.QSM,a.CNM]}}(hljs);hljs.LANGUAGES.brainfuck=function(a){return{c:[{cN:\"comment\",b:\"[^\\\\[\\\\]\\\\.,\\\\+\\\\-<> \\r\\n]\",eE:true,e:\"[\\\\[\\\\]\\\\.,\\\\+\\\\-<> \\r\\n]\",r:0},{cN:\"title\",b:\"[\\\\[\\\\]]\",r:0},{cN:\"string\",b:\"[\\\\.,]\"},{cN:\"literal\",b:\"[\\\\+\\\\-]\"}]}}(hljs);hljs.LANGUAGES.ruby=function(e){var a=\"[a-zA-Z_][a-zA-Z0-9_]*(\\\\!|\\\\?)?\";var j=\"[a-zA-Z_]\\\\w*[!?=]?|[-+~]\\\\@|<<|>>|=~|===?|<=>|[<>]=?|\\\\*\\\\*|[-/+%^&*~`|]|\\\\[\\\\]=?\";var g={keyword:\"and false then defined module in return redo if BEGIN retry end for true self when next until do begin unless END rescue nil else break undef not super class case require yield alias while ensure elsif or include\"};var c={cN:\"yardoctag\",b:\"@[A-Za-z]+\"};var k=[{cN:\"comment\",b:\"#\",e:\"$\",c:[c]},{cN:\"comment\",b:\"^\\\\=begin\",e:\"^\\\\=end\",c:[c],r:10},{cN:\"comment\",b:\"^__END__\",e:\"\\\\n$\"}];var d={cN:\"subst\",b:\"#\\\\{\",e:\"}\",l:a,k:g};var i=[e.BE,d];var b=[{cN:\"string\",b:\"'\",e:\"'\",c:i,r:0},{cN:\"string\",b:'\"',e:'\"',c:i,r:0},{cN:\"string\",b:\"%[qw]?\\\\(\",e:\"\\\\)\",c:i},{cN:\"string\",b:\"%[qw]?\\\\[\",e:\"\\\\]\",c:i},{cN:\"string\",b:\"%[qw]?{\",e:\"}\",c:i},{cN:\"string\",b:\"%[qw]?<\",e:\">\",c:i,r:10},{cN:\"string\",b:\"%[qw]?/\",e:\"/\",c:i,r:10},{cN:\"string\",b:\"%[qw]?%\",e:\"%\",c:i,r:10},{cN:\"string\",b:\"%[qw]?-\",e:\"-\",c:i,r:10},{cN:\"string\",b:\"%[qw]?\\\\|\",e:\"\\\\|\",c:i,r:10}];var h={cN:\"function\",bWK:true,e:\" |$|;\",k:\"def\",c:[{cN:\"title\",b:j,l:a,k:g},{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",l:a,k:g}].concat(k)};var f=k.concat(b.concat([{cN:\"class\",bWK:true,e:\"$|;\",k:\"class module\",c:[{cN:\"title\",b:\"[A-Za-z_]\\\\w*(::\\\\w+)*(\\\\?|\\\\!)?\",r:0},{cN:\"inheritance\",b:\"<\\\\s*\",c:[{cN:\"parent\",b:\"(\"+e.IR+\"::)?\"+e.IR}]}].concat(k)},h,{cN:\"constant\",b:\"(::)?(\\\\b[A-Z]\\\\w*(::)?)+\",r:0},{cN:\"symbol\",b:\":\",c:b.concat([{b:j}]),r:0},{cN:\"symbol\",b:a+\":\",r:0},{cN:\"number\",b:\"(\\\\b0[0-7_]+)|(\\\\b0x[0-9a-fA-F_]+)|(\\\\b[1-9][0-9_]*(\\\\.[0-9_]+)?)|[0_]\\\\b\",r:0},{cN:\"number\",b:\"\\\\?\\\\w\"},{cN:\"variable\",b:\"(\\\\$\\\\W)|((\\\\$|\\\\@\\\\@?)(\\\\w+))\"},{b:\"(\"+e.RSR+\")\\\\s*\",c:k.concat([{cN:\"regexp\",b:\"/\",e:\"/[a-z]*\",i:\"\\\\n\",c:[e.BE,d]}]),r:0}]));d.c=f;h.c[1].c=f;return{l:a,k:g,c:f}}(hljs);hljs.LANGUAGES.rust=function(b){var d={cN:\"title\",b:b.UIR};var c={cN:\"number\",b:\"\\\\b(0[xb][A-Za-z0-9_]+|[0-9_]+(\\\\.[0-9_]+)?([uif](8|16|32|64)?)?)\",r:0};var a=\"alt any as assert be bind block bool break char check claim const cont dir do else enum export f32 f64 fail false float fn for i16 i32 i64 i8 if iface impl import in int let log mod mutable native note of prove pure resource ret self str syntax true type u16 u32 u64 u8 uint unchecked unsafe use vec while\";return{k:a,i:\"</\",c:[b.CLCM,b.CBLCLM,b.inherit(b.QSM,{i:null}),b.ASM,c,{cN:\"function\",bWK:true,e:\"(\\\\(|<)\",k:\"fn\",c:[d]},{cN:\"preprocessor\",b:\"#\\\\[\",e:\"\\\\]\"},{bWK:true,e:\"(=|<)\",k:\"type\",c:[d],i:\"\\\\S\"},{bWK:true,e:\"({|<)\",k:\"iface enum\",c:[d],i:\"\\\\S\"}]}}(hljs);hljs.LANGUAGES.rib=function(a){return{k:\"ArchiveRecord AreaLightSource Atmosphere Attribute AttributeBegin AttributeEnd Basis Begin Blobby Bound Clipping ClippingPlane Color ColorSamples ConcatTransform Cone CoordinateSystem CoordSysTransform CropWindow Curves Cylinder DepthOfField Detail DetailRange Disk Displacement Display End ErrorHandler Exposure Exterior Format FrameAspectRatio FrameBegin FrameEnd GeneralPolygon GeometricApproximation Geometry Hider Hyperboloid Identity Illuminate Imager Interior LightSource MakeCubeFaceEnvironment MakeLatLongEnvironment MakeShadow MakeTexture Matte MotionBegin MotionEnd NuPatch ObjectBegin ObjectEnd ObjectInstance Opacity Option Orientation Paraboloid Patch PatchMesh Perspective PixelFilter PixelSamples PixelVariance Points PointsGeneralPolygons PointsPolygons Polygon Procedural Projection Quantize ReadArchive RelativeDetail ReverseOrientation Rotate Scale ScreenWindow ShadingInterpolation ShadingRate Shutter Sides Skew SolidBegin SolidEnd Sphere SubdivisionMesh Surface TextureCoordinates Torus Transform TransformBegin TransformEnd TransformPoints Translate TrimCurve WorldBegin WorldEnd\",i:\"</\",c:[a.HCM,a.CNM,a.ASM,a.QSM]}}(hljs);hljs.LANGUAGES.diff=function(a){return{c:[{cN:\"chunk\",b:\"^\\\\@\\\\@ +\\\\-\\\\d+,\\\\d+ +\\\\+\\\\d+,\\\\d+ +\\\\@\\\\@$\",r:10},{cN:\"chunk\",b:\"^\\\\*\\\\*\\\\* +\\\\d+,\\\\d+ +\\\\*\\\\*\\\\*\\\\*$\",r:10},{cN:\"chunk\",b:\"^\\\\-\\\\-\\\\- +\\\\d+,\\\\d+ +\\\\-\\\\-\\\\-\\\\-$\",r:10},{cN:\"header\",b:\"Index: \",e:\"$\"},{cN:\"header\",b:\"=====\",e:\"=====$\"},{cN:\"header\",b:\"^\\\\-\\\\-\\\\-\",e:\"$\"},{cN:\"header\",b:\"^\\\\*{3} \",e:\"$\"},{cN:\"header\",b:\"^\\\\+\\\\+\\\\+\",e:\"$\"},{cN:\"header\",b:\"\\\\*{5}\",e:\"\\\\*{5}$\"},{cN:\"addition\",b:\"^\\\\+\",e:\"$\"},{cN:\"deletion\",b:\"^\\\\-\",e:\"$\"},{cN:\"change\",b:\"^\\\\!\",e:\"$\"}]}}(hljs);hljs.LANGUAGES.javascript=function(a){return{k:{keyword:\"in if for while finally var new function do return void else break catch instanceof with throw case default try this switch continue typeof delete let yield const\",literal:\"true false null undefined NaN Infinity\"},c:[a.ASM,a.QSM,a.CLCM,a.CBLCLM,a.CNM,{b:\"(\"+a.RSR+\"|\\\\b(case|return|throw)\\\\b)\\\\s*\",k:\"return throw case\",c:[a.CLCM,a.CBLCLM,{cN:\"regexp\",b:\"/\",e:\"/[gim]*\",i:\"\\\\n\",c:[{b:\"\\\\\\\\/\"}]},{b:\"<\",e:\">;\",sL:\"xml\"}],r:0},{cN:\"function\",bWK:true,e:\"{\",k:\"function\",c:[{cN:\"title\",b:\"[A-Za-z$_][0-9A-Za-z$_]*\"},{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",c:[a.CLCM,a.CBLCLM],i:\"[\\\"'\\\\(]\"}],i:\"\\\\[|%\"}]}}(hljs);hljs.LANGUAGES.glsl=function(a){return{k:{keyword:\"atomic_uint attribute bool break bvec2 bvec3 bvec4 case centroid coherent const continue default discard dmat2 dmat2x2 dmat2x3 dmat2x4 dmat3 dmat3x2 dmat3x3 dmat3x4 dmat4 dmat4x2 dmat4x3 dmat4x4 do double dvec2 dvec3 dvec4 else flat float for highp if iimage1D iimage1DArray iimage2D iimage2DArray iimage2DMS iimage2DMSArray iimage2DRect iimage3D iimageBuffer iimageCube iimageCubeArray image1D image1DArray image2D image2DArray image2DMS image2DMSArray image2DRect image3D imageBuffer imageCube imageCubeArray in inout int invariant isampler1D isampler1DArray isampler2D isampler2DArray isampler2DMS isampler2DMSArray isampler2DRect isampler3D isamplerBuffer isamplerCube isamplerCubeArray ivec2 ivec3 ivec4 layout lowp mat2 mat2x2 mat2x3 mat2x4 mat3 mat3x2 mat3x3 mat3x4 mat4 mat4x2 mat4x3 mat4x4 mediump noperspective out patch precision readonly restrict return sample sampler1D sampler1DArray sampler1DArrayShadow sampler1DShadow sampler2D sampler2DArray sampler2DArrayShadow sampler2DMS sampler2DMSArray sampler2DRect sampler2DRectShadow sampler2DShadow sampler3D samplerBuffer samplerCube samplerCubeArray samplerCubeArrayShadow samplerCubeShadow smooth struct subroutine switch uimage1D uimage1DArray uimage2D uimage2DArray uimage2DMS uimage2DMSArray uimage2DRect uimage3D uimageBuffer uimageCube uimageCubeArray uint uniform usampler1D usampler1DArray usampler2D usampler2DArray usampler2DMS usampler2DMSArray usampler2DRect usampler3D usamplerBuffer usamplerCube usamplerCubeArray uvec2 uvec3 uvec4 varying vec2 vec3 vec4 void volatile while writeonly\",built_in:\"gl_BackColor gl_BackLightModelProduct gl_BackLightProduct gl_BackMaterial gl_BackSecondaryColor gl_ClipDistance gl_ClipPlane gl_ClipVertex gl_Color gl_DepthRange gl_EyePlaneQ gl_EyePlaneR gl_EyePlaneS gl_EyePlaneT gl_Fog gl_FogCoord gl_FogFragCoord gl_FragColor gl_FragCoord gl_FragData gl_FragDepth gl_FrontColor gl_FrontFacing gl_FrontLightModelProduct gl_FrontLightProduct gl_FrontMaterial gl_FrontSecondaryColor gl_InstanceID gl_InvocationID gl_Layer gl_LightModel gl_LightSource gl_MaxAtomicCounterBindings gl_MaxAtomicCounterBufferSize gl_MaxClipDistances gl_MaxClipPlanes gl_MaxCombinedAtomicCounterBuffers gl_MaxCombinedAtomicCounters gl_MaxCombinedImageUniforms gl_MaxCombinedImageUnitsAndFragmentOutputs gl_MaxCombinedTextureImageUnits gl_MaxDrawBuffers gl_MaxFragmentAtomicCounterBuffers gl_MaxFragmentAtomicCounters gl_MaxFragmentImageUniforms gl_MaxFragmentInputComponents gl_MaxFragmentUniformComponents gl_MaxFragmentUniformVectors gl_MaxGeometryAtomicCounterBuffers gl_MaxGeometryAtomicCounters gl_MaxGeometryImageUniforms gl_MaxGeometryInputComponents gl_MaxGeometryOutputComponents gl_MaxGeometryOutputVertices gl_MaxGeometryTextureImageUnits gl_MaxGeometryTotalOutputComponents gl_MaxGeometryUniformComponents gl_MaxGeometryVaryingComponents gl_MaxImageSamples gl_MaxImageUnits gl_MaxLights gl_MaxPatchVertices gl_MaxProgramTexelOffset gl_MaxTessControlAtomicCounterBuffers gl_MaxTessControlAtomicCounters gl_MaxTessControlImageUniforms gl_MaxTessControlInputComponents gl_MaxTessControlOutputComponents gl_MaxTessControlTextureImageUnits gl_MaxTessControlTotalOutputComponents gl_MaxTessControlUniformComponents gl_MaxTessEvaluationAtomicCounterBuffers gl_MaxTessEvaluationAtomicCounters gl_MaxTessEvaluationImageUniforms gl_MaxTessEvaluationInputComponents gl_MaxTessEvaluationOutputComponents gl_MaxTessEvaluationTextureImageUnits gl_MaxTessEvaluationUniformComponents gl_MaxTessGenLevel gl_MaxTessPatchComponents gl_MaxTextureCoords gl_MaxTextureImageUnits gl_MaxTextureUnits gl_MaxVaryingComponents gl_MaxVaryingFloats gl_MaxVaryingVectors gl_MaxVertexAtomicCounterBuffers gl_MaxVertexAtomicCounters gl_MaxVertexAttribs gl_MaxVertexImageUniforms gl_MaxVertexOutputComponents gl_MaxVertexTextureImageUnits gl_MaxVertexUniformComponents gl_MaxVertexUniformVectors gl_MaxViewports gl_MinProgramTexelOffsetgl_ModelViewMatrix gl_ModelViewMatrixInverse gl_ModelViewMatrixInverseTranspose gl_ModelViewMatrixTranspose gl_ModelViewProjectionMatrix gl_ModelViewProjectionMatrixInverse gl_ModelViewProjectionMatrixInverseTranspose gl_ModelViewProjectionMatrixTranspose gl_MultiTexCoord0 gl_MultiTexCoord1 gl_MultiTexCoord2 gl_MultiTexCoord3 gl_MultiTexCoord4 gl_MultiTexCoord5 gl_MultiTexCoord6 gl_MultiTexCoord7 gl_Normal gl_NormalMatrix gl_NormalScale gl_ObjectPlaneQ gl_ObjectPlaneR gl_ObjectPlaneS gl_ObjectPlaneT gl_PatchVerticesIn gl_PerVertex gl_Point gl_PointCoord gl_PointSize gl_Position gl_PrimitiveID gl_PrimitiveIDIn gl_ProjectionMatrix gl_ProjectionMatrixInverse gl_ProjectionMatrixInverseTranspose gl_ProjectionMatrixTranspose gl_SampleID gl_SampleMask gl_SampleMaskIn gl_SamplePosition gl_SecondaryColor gl_TessCoord gl_TessLevelInner gl_TessLevelOuter gl_TexCoord gl_TextureEnvColor gl_TextureMatrixInverseTranspose gl_TextureMatrixTranspose gl_Vertex gl_VertexID gl_ViewportIndex gl_in gl_out EmitStreamVertex EmitVertex EndPrimitive EndStreamPrimitive abs acos acosh all any asin asinh atan atanh atomicCounter atomicCounterDecrement atomicCounterIncrement barrier bitCount bitfieldExtract bitfieldInsert bitfieldReverse ceil clamp cos cosh cross dFdx dFdy degrees determinant distance dot equal exp exp2 faceforward findLSB findMSB floatBitsToInt floatBitsToUint floor fma fract frexp ftransform fwidth greaterThan greaterThanEqual imageAtomicAdd imageAtomicAnd imageAtomicCompSwap imageAtomicExchange imageAtomicMax imageAtomicMin imageAtomicOr imageAtomicXor imageLoad imageStore imulExtended intBitsToFloat interpolateAtCentroid interpolateAtOffset interpolateAtSample inverse inversesqrt isinf isnan ldexp length lessThan lessThanEqual log log2 matrixCompMult max memoryBarrier min mix mod modf noise1 noise2 noise3 noise4 normalize not notEqual outerProduct packDouble2x32 packHalf2x16 packSnorm2x16 packSnorm4x8 packUnorm2x16 packUnorm4x8 pow radians reflect refract round roundEven shadow1D shadow1DLod shadow1DProj shadow1DProjLod shadow2D shadow2DLod shadow2DProj shadow2DProjLod sign sin sinh smoothstep sqrt step tan tanh texelFetch texelFetchOffset texture texture1D texture1DLod texture1DProj texture1DProjLod texture2D texture2DLod texture2DProj texture2DProjLod texture3D texture3DLod texture3DProj texture3DProjLod textureCube textureCubeLod textureGather textureGatherOffset textureGatherOffsets textureGrad textureGradOffset textureLod textureLodOffset textureOffset textureProj textureProjGrad textureProjGradOffset textureProjLod textureProjLodOffset textureProjOffset textureQueryLod textureSize transpose trunc uaddCarry uintBitsToFloat umulExtended unpackDouble2x32 unpackHalf2x16 unpackSnorm2x16 unpackSnorm4x8 unpackUnorm2x16 unpackUnorm4x8 usubBorrow gl_TextureMatrix gl_TextureMatrixInverse\",literal:\"true false\"},i:'\"',c:[a.CLCM,a.CBLCLM,a.CNM,{cN:\"preprocessor\",b:\"#\",e:\"$\"}]}}(hljs);hljs.LANGUAGES.rsl=function(a){return{k:{keyword:\"float color point normal vector matrix while for if do return else break extern continue\",built_in:\"abs acos ambient area asin atan atmosphere attribute calculatenormal ceil cellnoise clamp comp concat cos degrees depth Deriv diffuse distance Du Dv environment exp faceforward filterstep floor format fresnel incident length lightsource log match max min mod noise normalize ntransform opposite option phong pnoise pow printf ptlined radians random reflect refract renderinfo round setcomp setxcomp setycomp setzcomp shadow sign sin smoothstep specular specularbrdf spline sqrt step tan texture textureinfo trace transform vtransform xcomp ycomp zcomp\"},i:\"</\",c:[a.CLCM,a.CBLCLM,a.QSM,a.ASM,a.CNM,{cN:\"preprocessor\",b:\"#\",e:\"$\"},{cN:\"shader\",bWK:true,e:\"\\\\(\",k:\"surface displacement light volume imager\"},{cN:\"shading\",bWK:true,e:\"\\\\(\",k:\"illuminate illuminance gather\"}]}}(hljs);hljs.LANGUAGES.lua=function(b){var a=\"\\\\[=*\\\\[\";var e=\"\\\\]=*\\\\]\";var c={b:a,e:e,c:[\"self\"]};var d=[{cN:\"comment\",b:\"--(?!\"+a+\")\",e:\"$\"},{cN:\"comment\",b:\"--\"+a,e:e,c:[c],r:10}];return{l:b.UIR,k:{keyword:\"and break do else elseif end false for if in local nil not or repeat return then true until while\",built_in:\"_G _VERSION assert collectgarbage dofile error getfenv getmetatable ipairs load loadfile loadstring module next pairs pcall print rawequal rawget rawset require select setfenv setmetatable tonumber tostring type unpack xpcall coroutine debug io math os package string table\"},c:d.concat([{cN:\"function\",bWK:true,e:\"\\\\)\",k:\"function\",c:[{cN:\"title\",b:\"([_a-zA-Z]\\\\w*\\\\.)*([_a-zA-Z]\\\\w*:)?[_a-zA-Z]\\\\w*\"},{cN:\"params\",b:\"\\\\(\",eW:true,c:d}].concat(d)},b.CNM,b.ASM,b.QSM,{cN:\"string\",b:a,e:e,c:[c],r:10}])}}(hljs);hljs.LANGUAGES.xml=function(a){var c=\"[A-Za-z0-9\\\\._:-]+\";var b={eW:true,c:[{cN:\"attribute\",b:c,r:0},{b:'=\"',rB:true,e:'\"',c:[{cN:\"value\",b:'\"',eW:true}]},{b:\"='\",rB:true,e:\"'\",c:[{cN:\"value\",b:\"'\",eW:true}]},{b:\"=\",c:[{cN:\"value\",b:\"[^\\\\s/>]+\"}]}]};return{cI:true,c:[{cN:\"pi\",b:\"<\\\\?\",e:\"\\\\?>\",r:10},{cN:\"doctype\",b:\"<!DOCTYPE\",e:\">\",r:10,c:[{b:\"\\\\[\",e:\"\\\\]\"}]},{cN:\"comment\",b:\"<!--\",e:\"-->\",r:10},{cN:\"cdata\",b:\"<\\\\!\\\\[CDATA\\\\[\",e:\"\\\\]\\\\]>\",r:10},{cN:\"tag\",b:\"<style(?=\\\\s|>|$)\",e:\">\",k:{title:\"style\"},c:[b],starts:{e:\"</style>\",rE:true,sL:\"css\"}},{cN:\"tag\",b:\"<script(?=\\\\s|>|$)\",e:\">\",k:{title:\"script\"},c:[b],starts:{e:\"<\\/script>\",rE:true,sL:\"javascript\"}},{b:\"<%\",e:\"%>\",sL:\"vbscript\"},{cN:\"tag\",b:\"</?\",e:\"/?>\",c:[{cN:\"title\",b:\"[^ />]+\"},b]}]}}(hljs);hljs.LANGUAGES.markdown=function(a){return{c:[{cN:\"header\",b:\"^#{1,3}\",e:\"$\"},{cN:\"header\",b:\"^.+?\\\\n[=-]{2,}$\"},{b:\"<\",e:\">\",sL:\"xml\",r:0},{cN:\"bullet\",b:\"^([*+-]|(\\\\d+\\\\.))\\\\s+\"},{cN:\"strong\",b:\"[*_]{2}.+?[*_]{2}\"},{cN:\"emphasis\",b:\"\\\\*.+?\\\\*\"},{cN:\"emphasis\",b:\"_.+?_\",r:0},{cN:\"blockquote\",b:\"^>\\\\s+\",e:\"$\"},{cN:\"code\",b:\"`.+?`\"},{cN:\"code\",b:\"^    \",e:\"$\",r:0},{cN:\"horizontal_rule\",b:\"^-{3,}\",e:\"$\"},{b:\"\\\\[.+?\\\\]\\\\(.+?\\\\)\",rB:true,c:[{cN:\"link_label\",b:\"\\\\[.+\\\\]\"},{cN:\"link_url\",b:\"\\\\(\",e:\"\\\\)\",eB:true,eE:true}]}]}}(hljs);hljs.LANGUAGES.css=function(a){var b={cN:\"function\",b:a.IR+\"\\\\(\",e:\"\\\\)\",c:[a.NM,a.ASM,a.QSM]};return{cI:true,i:\"[=/|']\",c:[a.CBLCLM,{cN:\"id\",b:\"\\\\#[A-Za-z0-9_-]+\"},{cN:\"class\",b:\"\\\\.[A-Za-z0-9_-]+\",r:0},{cN:\"attr_selector\",b:\"\\\\[\",e:\"\\\\]\",i:\"$\"},{cN:\"pseudo\",b:\":(:)?[a-zA-Z0-9\\\\_\\\\-\\\\+\\\\(\\\\)\\\\\\\"\\\\']+\"},{cN:\"at_rule\",b:\"@(font-face|page)\",l:\"[a-z-]+\",k:\"font-face page\"},{cN:\"at_rule\",b:\"@\",e:\"[{;]\",eE:true,k:\"import page media charset\",c:[b,a.ASM,a.QSM,a.NM]},{cN:\"tag\",b:a.IR,r:0},{cN:\"rules\",b:\"{\",e:\"}\",i:\"[^\\\\s]\",r:0,c:[a.CBLCLM,{cN:\"rule\",b:\"[^\\\\s]\",rB:true,e:\";\",eW:true,c:[{cN:\"attribute\",b:\"[A-Z\\\\_\\\\.\\\\-]+\",e:\":\",eE:true,i:\"[^\\\\s]\",starts:{cN:\"value\",eW:true,eE:true,c:[b,a.NM,a.QSM,a.ASM,a.CBLCLM,{cN:\"hexcolor\",b:\"\\\\#[0-9A-F]+\"},{cN:\"important\",b:\"!important\"}]}}]}]}]}}(hljs);hljs.LANGUAGES.lisp=function(i){var k=\"[a-zA-Z_\\\\-\\\\+\\\\*\\\\/\\\\<\\\\=\\\\>\\\\&\\\\#][a-zA-Z0-9_\\\\-\\\\+\\\\*\\\\/\\\\<\\\\=\\\\>\\\\&\\\\#]*\";var l=\"(\\\\-|\\\\+)?\\\\d+(\\\\.\\\\d+|\\\\/\\\\d+)?((d|e|f|l|s)(\\\\+|\\\\-)?\\\\d+)?\";var a={cN:\"literal\",b:\"\\\\b(t{1}|nil)\\\\b\"};var d=[{cN:\"number\",b:l},{cN:\"number\",b:\"#b[0-1]+(/[0-1]+)?\"},{cN:\"number\",b:\"#o[0-7]+(/[0-7]+)?\"},{cN:\"number\",b:\"#x[0-9a-f]+(/[0-9a-f]+)?\"},{cN:\"number\",b:\"#c\\\\(\"+l+\" +\"+l,e:\"\\\\)\"}];var h={cN:\"string\",b:'\"',e:'\"',c:[i.BE],r:0};var m={cN:\"comment\",b:\";\",e:\"$\"};var g={cN:\"variable\",b:\"\\\\*\",e:\"\\\\*\"};var n={cN:\"keyword\",b:\"[:&]\"+k};var b={b:\"\\\\(\",e:\"\\\\)\",c:[\"self\",a,h].concat(d)};var e={cN:\"quoted\",b:\"['`]\\\\(\",e:\"\\\\)\",c:d.concat([h,g,n,b])};var c={cN:\"quoted\",b:\"\\\\(quote \",e:\"\\\\)\",k:{title:\"quote\"},c:d.concat([h,g,n,b])};var j={cN:\"list\",b:\"\\\\(\",e:\"\\\\)\"};var f={cN:\"body\",eW:true,eE:true};j.c=[{cN:\"title\",b:k},f];f.c=[e,c,j,a].concat(d).concat([h,m,g,n]);return{i:\"[^\\\\s]\",c:d.concat([a,h,m,e,c,j])}}(hljs);hljs.LANGUAGES.profile=function(a){return{c:[a.CNM,{cN:\"builtin\",b:\"{\",e:\"}$\",eB:true,eE:true,c:[a.ASM,a.QSM],r:0},{cN:\"filename\",b:\"[a-zA-Z_][\\\\da-zA-Z_]+\\\\.[\\\\da-zA-Z_]{1,3}\",e:\":\",eE:true},{cN:\"header\",b:\"(ncalls|tottime|cumtime)\",e:\"$\",k:\"ncalls tottime|10 cumtime|10 filename\",r:10},{cN:\"summary\",b:\"function calls\",e:\"$\",c:[a.CNM],r:10},a.ASM,a.QSM,{cN:\"function\",b:\"\\\\(\",e:\"\\\\)$\",c:[{cN:\"title\",b:a.UIR,r:0}],r:0}]}}(hljs);hljs.LANGUAGES.http=function(a){return{i:\"\\\\S\",c:[{cN:\"status\",b:\"^HTTP/[0-9\\\\.]+\",e:\"$\",c:[{cN:\"number\",b:\"\\\\b\\\\d{3}\\\\b\"}]},{cN:\"request\",b:\"^[A-Z]+ (.*?) HTTP/[0-9\\\\.]+$\",rB:true,e:\"$\",c:[{cN:\"string\",b:\" \",e:\" \",eB:true,eE:true}]},{cN:\"attribute\",b:\"^\\\\w\",e:\": \",eE:true,i:\"\\\\n|\\\\s|=\",starts:{cN:\"string\",e:\"$\"}},{b:\"\\\\n\\\\n\",starts:{sL:\"\",eW:true}}]}}(hljs);hljs.LANGUAGES.java=function(a){return{k:\"false synchronized int abstract float private char boolean static null if const for true while long throw strictfp finally protected import native final return void enum else break transient new catch instanceof byte super volatile case assert short package default double public try this switch continue throws\",c:[{cN:\"javadoc\",b:\"/\\\\*\\\\*\",e:\"\\\\*/\",c:[{cN:\"javadoctag\",b:\"@[A-Za-z]+\"}],r:10},a.CLCM,a.CBLCLM,a.ASM,a.QSM,{cN:\"class\",bWK:true,e:\"{\",k:\"class interface\",i:\":\",c:[{bWK:true,k:\"extends implements\",r:10},{cN:\"title\",b:a.UIR}]},a.CNM,{cN:\"annotation\",b:\"@[A-Za-z]+\"}]}}(hljs);hljs.LANGUAGES.php=function(a){var e={cN:\"variable\",b:\"\\\\$+[a-zA-Z_\\x7f-\\xff][a-zA-Z0-9_\\x7f-\\xff]*\"};var b=[a.inherit(a.ASM,{i:null}),a.inherit(a.QSM,{i:null}),{cN:\"string\",b:'b\"',e:'\"',c:[a.BE]},{cN:\"string\",b:\"b'\",e:\"'\",c:[a.BE]}];var c=[a.BNM,a.CNM];var d={cN:\"title\",b:a.UIR};return{cI:true,k:\"and include_once list abstract global private echo interface as static endswitch array null if endwhile or const for endforeach self var while isset public protected exit foreach throw elseif include __FILE__ empty require_once do xor return implements parent clone use __CLASS__ __LINE__ else break print eval new catch __METHOD__ case exception php_user_filter default die require __FUNCTION__ enddeclare final try this switch continue endfor endif declare unset true false namespace trait goto instanceof insteadof __DIR__ __NAMESPACE__ __halt_compiler\",c:[a.CLCM,a.HCM,{cN:\"comment\",b:\"/\\\\*\",e:\"\\\\*/\",c:[{cN:\"phpdoc\",b:\"\\\\s@[A-Za-z]+\"}]},{cN:\"comment\",eB:true,b:\"__halt_compiler.+?;\",eW:true},{cN:\"string\",b:\"<<<['\\\"]?\\\\w+['\\\"]?$\",e:\"^\\\\w+;\",c:[a.BE]},{cN:\"preprocessor\",b:\"<\\\\?php\",r:10},{cN:\"preprocessor\",b:\"\\\\?>\"},e,{cN:\"function\",bWK:true,e:\"{\",k:\"function\",i:\"\\\\$|\\\\[|%\",c:[d,{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",c:[\"self\",e,a.CBLCLM].concat(b).concat(c)}]},{cN:\"class\",bWK:true,e:\"{\",k:\"class\",i:\"[:\\\\(\\\\$]\",c:[{bWK:true,eW:true,k:\"extends\",c:[d]},d]},{b:\"=>\"}].concat(b).concat(c)}}(hljs);hljs.LANGUAGES.haskell=function(a){var d={cN:\"type\",b:\"\\\\b[A-Z][\\\\w']*\",r:0};var c={cN:\"container\",b:\"\\\\(\",e:\"\\\\)\",c:[{cN:\"type\",b:\"\\\\b[A-Z][\\\\w]*(\\\\((\\\\.\\\\.|,|\\\\w+)\\\\))?\"},{cN:\"title\",b:\"[_a-z][\\\\w']*\"}]};var b={cN:\"container\",b:\"{\",e:\"}\",c:c.c};return{k:\"let in if then else case of where do module import hiding qualified type data newtype deriving class instance not as foreign ccall safe unsafe\",c:[{cN:\"comment\",b:\"--\",e:\"$\"},{cN:\"preprocessor\",b:\"{-#\",e:\"#-}\"},{cN:\"comment\",c:[\"self\"],b:\"{-\",e:\"-}\"},{cN:\"string\",b:\"\\\\s+'\",e:\"'\",c:[a.BE],r:0},a.QSM,{cN:\"import\",b:\"\\\\bimport\",e:\"$\",k:\"import qualified as hiding\",c:[c],i:\"\\\\W\\\\.|;\"},{cN:\"module\",b:\"\\\\bmodule\",e:\"where\",k:\"module where\",c:[c],i:\"\\\\W\\\\.|;\"},{cN:\"class\",b:\"\\\\b(class|instance)\",e:\"where\",k:\"class where instance\",c:[d]},{cN:\"typedef\",b:\"\\\\b(data|(new)?type)\",e:\"$\",k:\"data type newtype deriving\",c:[d,c,b]},a.CNM,{cN:\"shebang\",b:\"#!\\\\/usr\\\\/bin\\\\/env runhaskell\",e:\"$\"},d,{cN:\"title\",b:\"^[_a-z][\\\\w']*\"}]}}(hljs);hljs.LANGUAGES[\"1c\"]=function(b){var f=\"[a-zA-ZÐ°-ÑÐ-Ð¯][a-zA-Z0-9_Ð°-ÑÐ-Ð¯]*\";var c=\"Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‚ Ð´Ð°Ñ‚Ð° Ð´Ð»Ñ ÐµÑÐ»Ð¸ Ð¸ Ð¸Ð»Ð¸ Ð¸Ð½Ð°Ñ‡Ðµ Ð¸Ð½Ð°Ñ‡ÐµÐµÑÐ»Ð¸ Ð¸ÑÐºÐ»ÑŽÑ‡ÐµÐ½Ð¸Ðµ ÐºÐ¾Ð½ÐµÑ†ÐµÑÐ»Ð¸ ÐºÐ¾Ð½ÐµÑ†Ð¿Ð¾Ð¿Ñ‹Ñ‚ÐºÐ¸ ÐºÐ¾Ð½ÐµÑ†Ð¿Ñ€Ð¾Ñ†ÐµÐ´ÑƒÑ€Ñ‹ ÐºÐ¾Ð½ÐµÑ†Ñ„ÑƒÐ½ÐºÑ†Ð¸Ð¸ ÐºÐ¾Ð½ÐµÑ†Ñ†Ð¸ÐºÐ»Ð° ÐºÐ¾Ð½ÑÑ‚Ð°Ð½Ñ‚Ð° Ð½Ðµ Ð¿ÐµÑ€ÐµÐ¹Ñ‚Ð¸ Ð¿ÐµÑ€ÐµÐ¼ Ð¿ÐµÑ€ÐµÑ‡Ð¸ÑÐ»ÐµÐ½Ð¸Ðµ Ð¿Ð¾ Ð¿Ð¾ÐºÐ° Ð¿Ð¾Ð¿Ñ‹Ñ‚ÐºÐ° Ð¿Ñ€ÐµÑ€Ð²Ð°Ñ‚ÑŒ Ð¿Ñ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚ÑŒ Ð¿Ñ€Ð¾Ñ†ÐµÐ´ÑƒÑ€Ð° ÑÑ‚Ñ€Ð¾ÐºÐ° Ñ‚Ð¾Ð³Ð´Ð° Ñ„Ñ Ñ„ÑƒÐ½ÐºÑ†Ð¸Ñ Ñ†Ð¸ÐºÐ» Ñ‡Ð¸ÑÐ»Ð¾ ÑÐºÑÐ¿Ð¾Ñ€Ñ‚\";var e=\"ansitooem oemtoansi Ð²Ð²ÐµÑÑ‚Ð¸Ð²Ð¸Ð´ÑÑƒÐ±ÐºÐ¾Ð½Ñ‚Ð¾ Ð²Ð²ÐµÑÑ‚Ð¸Ð´Ð°Ñ‚Ñƒ Ð²Ð²ÐµÑÑ‚Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ Ð²Ð²ÐµÑÑ‚Ð¸Ð¿ÐµÑ€ÐµÑ‡Ð¸ÑÐ»ÐµÐ½Ð¸Ðµ Ð²Ð²ÐµÑÑ‚Ð¸Ð¿ÐµÑ€Ð¸Ð¾Ð´ Ð²Ð²ÐµÑÑ‚Ð¸Ð¿Ð»Ð°Ð½ÑÑ‡ÐµÑ‚Ð¾Ð² Ð²Ð²ÐµÑÑ‚Ð¸ÑÑ‚Ñ€Ð¾ÐºÑƒ Ð²Ð²ÐµÑÑ‚Ð¸Ñ‡Ð¸ÑÐ»Ð¾ Ð²Ð¾Ð¿Ñ€Ð¾Ñ Ð²Ð¾ÑÑÑ‚Ð°Ð½Ð¾Ð²Ð¸Ñ‚ÑŒÐ·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ Ð²Ñ€ÐµÐ³ Ð²Ñ‹Ð±Ñ€Ð°Ð½Ð½Ñ‹Ð¹Ð¿Ð»Ð°Ð½ÑÑ‡ÐµÑ‚Ð¾Ð² Ð²Ñ‹Ð·Ð²Ð°Ñ‚ÑŒÐ¸ÑÐºÐ»ÑŽÑ‡ÐµÐ½Ð¸Ðµ Ð´Ð°Ñ‚Ð°Ð³Ð¾Ð´ Ð´Ð°Ñ‚Ð°Ð¼ÐµÑÑÑ† Ð´Ð°Ñ‚Ð°Ñ‡Ð¸ÑÐ»Ð¾ Ð´Ð¾Ð±Ð°Ð²Ð¸Ñ‚ÑŒÐ¼ÐµÑÑÑ† Ð·Ð°Ð²ÐµÑ€ÑˆÐ¸Ñ‚ÑŒÑ€Ð°Ð±Ð¾Ñ‚ÑƒÑÐ¸ÑÑ‚ÐµÐ¼Ñ‹ Ð·Ð°Ð³Ð¾Ð»Ð¾Ð²Ð¾ÐºÑÐ¸ÑÑ‚ÐµÐ¼Ñ‹ Ð·Ð°Ð¿Ð¸ÑÑŒÐ¶ÑƒÑ€Ð½Ð°Ð»Ð°Ñ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ð°Ñ†Ð¸Ð¸ Ð·Ð°Ð¿ÑƒÑÑ‚Ð¸Ñ‚ÑŒÐ¿Ñ€Ð¸Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ Ð·Ð°Ñ„Ð¸ÐºÑÐ¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒÑ‚Ñ€Ð°Ð½Ð·Ð°ÐºÑ†Ð¸ÑŽ Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÐµÐ²ÑÑ‚Ñ€Ð¾ÐºÑƒ Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÐµÐ²ÑÑ‚Ñ€Ð¾ÐºÑƒÐ²Ð½ÑƒÑ‚Ñ€ Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÐµÐ²Ñ„Ð°Ð¹Ð» Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÐµÐ¸Ð·ÑÑ‚Ñ€Ð¾ÐºÐ¸ Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÐµÐ¸Ð·ÑÑ‚Ñ€Ð¾ÐºÐ¸Ð²Ð½ÑƒÑ‚Ñ€ Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÐµÐ¸Ð·Ñ„Ð°Ð¹Ð»Ð° Ð¸Ð¼ÑÐºÐ¾Ð¼Ð¿ÑŒÑŽÑ‚ÐµÑ€Ð° Ð¸Ð¼ÑÐ¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ ÐºÐ°Ñ‚Ð°Ð»Ð¾Ð³Ð²Ñ€ÐµÐ¼ÐµÐ½Ð½Ñ‹Ñ…Ñ„Ð°Ð¹Ð»Ð¾Ð² ÐºÐ°Ñ‚Ð°Ð»Ð¾Ð³Ð¸Ð± ÐºÐ°Ñ‚Ð°Ð»Ð¾Ð³Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ ÐºÐ°Ñ‚Ð°Ð»Ð¾Ð³Ð¿Ñ€Ð¾Ð³Ñ€Ð°Ð¼Ð¼Ñ‹ ÐºÐ¾Ð´ÑÐ¸Ð¼Ð² ÐºÐ¾Ð¼Ð°Ð½Ð´Ð°ÑÐ¸ÑÑ‚ÐµÐ¼Ñ‹ ÐºÐ¾Ð½Ð³Ð¾Ð´Ð° ÐºÐ¾Ð½ÐµÑ†Ð¿ÐµÑ€Ð¸Ð¾Ð´Ð°Ð±Ð¸ ÐºÐ¾Ð½ÐµÑ†Ñ€Ð°ÑÑÑ‡Ð¸Ñ‚Ð°Ð½Ð½Ð¾Ð³Ð¾Ð¿ÐµÑ€Ð¸Ð¾Ð´Ð°Ð±Ð¸ ÐºÐ¾Ð½ÐµÑ†ÑÑ‚Ð°Ð½Ð´Ð°Ñ€Ñ‚Ð½Ð¾Ð³Ð¾Ð¸Ð½Ñ‚ÐµÑ€Ð²Ð°Ð»Ð° ÐºÐ¾Ð½ÐºÐ²Ð°Ñ€Ñ‚Ð°Ð»Ð° ÐºÐ¾Ð½Ð¼ÐµÑÑÑ†Ð° ÐºÐ¾Ð½Ð½ÐµÐ´ÐµÐ»Ð¸ Ð»ÐµÐ² Ð»Ð¾Ð³ Ð»Ð¾Ð³10 Ð¼Ð°ÐºÑ Ð¼Ð°ÐºÑÐ¸Ð¼Ð°Ð»ÑŒÐ½Ð¾ÐµÐºÐ¾Ð»Ð¸Ñ‡ÐµÑÑ‚Ð²Ð¾ÑÑƒÐ±ÐºÐ¾Ð½Ñ‚Ð¾ Ð¼Ð¸Ð½ Ð¼Ð¾Ð½Ð¾Ð¿Ð¾Ð»ÑŒÐ½Ñ‹Ð¹Ñ€ÐµÐ¶Ð¸Ð¼ Ð½Ð°Ð·Ð²Ð°Ð½Ð¸ÐµÐ¸Ð½Ñ‚ÐµÑ€Ñ„ÐµÐ¹ÑÐ° Ð½Ð°Ð·Ð²Ð°Ð½Ð¸ÐµÐ½Ð°Ð±Ð¾Ñ€Ð°Ð¿Ñ€Ð°Ð² Ð½Ð°Ð·Ð½Ð°Ñ‡Ð¸Ñ‚ÑŒÐ²Ð¸Ð´ Ð½Ð°Ð·Ð½Ð°Ñ‡Ð¸Ñ‚ÑŒÑÑ‡ÐµÑ‚ Ð½Ð°Ð¹Ñ‚Ð¸ Ð½Ð°Ð¹Ñ‚Ð¸Ð¿Ð¾Ð¼ÐµÑ‡ÐµÐ½Ð½Ñ‹ÐµÐ½Ð°ÑƒÐ´Ð°Ð»ÐµÐ½Ð¸Ðµ Ð½Ð°Ð¹Ñ‚Ð¸ÑÑÑ‹Ð»ÐºÐ¸ Ð½Ð°Ñ‡Ð°Ð»Ð¾Ð¿ÐµÑ€Ð¸Ð¾Ð´Ð°Ð±Ð¸ Ð½Ð°Ñ‡Ð°Ð»Ð¾ÑÑ‚Ð°Ð½Ð´Ð°Ñ€Ñ‚Ð½Ð¾Ð³Ð¾Ð¸Ð½Ñ‚ÐµÑ€Ð²Ð°Ð»Ð° Ð½Ð°Ñ‡Ð°Ñ‚ÑŒÑ‚Ñ€Ð°Ð½Ð·Ð°ÐºÑ†Ð¸ÑŽ Ð½Ð°Ñ‡Ð³Ð¾Ð´Ð° Ð½Ð°Ñ‡ÐºÐ²Ð°Ñ€Ñ‚Ð°Ð»Ð° Ð½Ð°Ñ‡Ð¼ÐµÑÑÑ†Ð° Ð½Ð°Ñ‡Ð½ÐµÐ´ÐµÐ»Ð¸ Ð½Ð¾Ð¼ÐµÑ€Ð´Ð½ÑÐ³Ð¾Ð´Ð° Ð½Ð¾Ð¼ÐµÑ€Ð´Ð½ÑÐ½ÐµÐ´ÐµÐ»Ð¸ Ð½Ð¾Ð¼ÐµÑ€Ð½ÐµÐ´ÐµÐ»Ð¸Ð³Ð¾Ð´Ð° Ð½Ñ€ÐµÐ³ Ð¾Ð±Ñ€Ð°Ð±Ð¾Ñ‚ÐºÐ°Ð¾Ð¶Ð¸Ð´Ð°Ð½Ð¸Ñ Ð¾ÐºÑ€ Ð¾Ð¿Ð¸ÑÐ°Ð½Ð¸ÐµÐ¾ÑˆÐ¸Ð±ÐºÐ¸ Ð¾ÑÐ½Ð¾Ð²Ð½Ð¾Ð¹Ð¶ÑƒÑ€Ð½Ð°Ð»Ñ€Ð°ÑÑ‡ÐµÑ‚Ð¾Ð² Ð¾ÑÐ½Ð¾Ð²Ð½Ð¾Ð¹Ð¿Ð»Ð°Ð½ÑÑ‡ÐµÑ‚Ð¾Ð² Ð¾ÑÐ½Ð¾Ð²Ð½Ð¾Ð¹ÑÐ·Ñ‹Ðº Ð¾Ñ‚ÐºÑ€Ñ‹Ñ‚ÑŒÑ„Ð¾Ñ€Ð¼Ñƒ Ð¾Ñ‚ÐºÑ€Ñ‹Ñ‚ÑŒÑ„Ð¾Ñ€Ð¼ÑƒÐ¼Ð¾Ð´Ð°Ð»ÑŒÐ½Ð¾ Ð¾Ñ‚Ð¼ÐµÐ½Ð¸Ñ‚ÑŒÑ‚Ñ€Ð°Ð½Ð·Ð°ÐºÑ†Ð¸ÑŽ Ð¾Ñ‡Ð¸ÑÑ‚Ð¸Ñ‚ÑŒÐ¾ÐºÐ½Ð¾ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹ Ð¿ÐµÑ€Ð¸Ð¾Ð´ÑÑ‚Ñ€ Ð¿Ð¾Ð»Ð½Ð¾ÐµÐ¸Ð¼ÑÐ¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÐ²Ñ€ÐµÐ¼ÑÑ‚Ð° Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÐ´Ð°Ñ‚ÑƒÑ‚Ð° Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÐ´Ð¾ÐºÑƒÐ¼ÐµÐ½Ñ‚Ñ‚Ð° Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÐ·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÑÐ¾Ñ‚Ð±Ð¾Ñ€Ð° Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÐ¿Ð¾Ð·Ð¸Ñ†Ð¸ÑŽÑ‚Ð° Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÐ¿ÑƒÑÑ‚Ð¾ÐµÐ·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÑ‚Ð° Ð¿Ñ€Ð°Ð² Ð¿Ñ€Ð°Ð²Ð¾Ð´Ð¾ÑÑ‚ÑƒÐ¿Ð° Ð¿Ñ€ÐµÐ´ÑƒÐ¿Ñ€ÐµÐ¶Ð´ÐµÐ½Ð¸Ðµ Ð¿Ñ€ÐµÑ„Ð¸ÐºÑÐ°Ð²Ñ‚Ð¾Ð½ÑƒÐ¼ÐµÑ€Ð°Ñ†Ð¸Ð¸ Ð¿ÑƒÑÑ‚Ð°ÑÑÑ‚Ñ€Ð¾ÐºÐ° Ð¿ÑƒÑÑ‚Ð¾ÐµÐ·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ Ñ€Ð°Ð±Ð¾Ñ‡Ð°ÑÐ´Ð°Ñ‚Ñ‚ÑŒÐ¿ÑƒÑÑ‚Ð¾ÐµÐ·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ Ñ€Ð°Ð±Ð¾Ñ‡Ð°ÑÐ´Ð°Ñ‚Ð° Ñ€Ð°Ð·Ð´ÐµÐ»Ð¸Ñ‚ÐµÐ»ÑŒÑÑ‚Ñ€Ð°Ð½Ð¸Ñ† Ñ€Ð°Ð·Ð´ÐµÐ»Ð¸Ñ‚ÐµÐ»ÑŒÑÑ‚Ñ€Ð¾Ðº Ñ€Ð°Ð·Ð¼ Ñ€Ð°Ð·Ð¾Ð±Ñ€Ð°Ñ‚ÑŒÐ¿Ð¾Ð·Ð¸Ñ†Ð¸ÑŽÐ´Ð¾ÐºÑƒÐ¼ÐµÐ½Ñ‚Ð° Ñ€Ð°ÑÑÑ‡Ð¸Ñ‚Ð°Ñ‚ÑŒÑ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ñ‹Ð½Ð° Ñ€Ð°ÑÑÑ‡Ð¸Ñ‚Ð°Ñ‚ÑŒÑ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ñ‹Ð¿Ð¾ ÑÐ¸Ð³Ð½Ð°Ð» ÑÐ¸Ð¼Ð² ÑÐ¸Ð¼Ð²Ð¾Ð»Ñ‚Ð°Ð±ÑƒÐ»ÑÑ†Ð¸Ð¸ ÑÐ¾Ð·Ð´Ð°Ñ‚ÑŒÐ¾Ð±ÑŠÐµÐºÑ‚ ÑÐ¾ÐºÑ€Ð» ÑÐ¾ÐºÑ€Ð»Ð¿ ÑÐ¾ÐºÑ€Ð¿ ÑÐ¾Ð¾Ð±Ñ‰Ð¸Ñ‚ÑŒ ÑÐ¾ÑÑ‚Ð¾ÑÐ½Ð¸Ðµ ÑÐ¾Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑŒÐ·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ ÑÑ€ÐµÐ´ ÑÑ‚Ð°Ñ‚ÑƒÑÐ²Ð¾Ð·Ð²Ñ€Ð°Ñ‚Ð° ÑÑ‚Ñ€Ð´Ð»Ð¸Ð½Ð° ÑÑ‚Ñ€Ð·Ð°Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ ÑÑ‚Ñ€ÐºÐ¾Ð»Ð¸Ñ‡ÐµÑÑ‚Ð²Ð¾ÑÑ‚Ñ€Ð¾Ðº ÑÑ‚Ñ€Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒÑÑ‚Ñ€Ð¾ÐºÑƒ  ÑÑ‚Ñ€Ñ‡Ð¸ÑÐ»Ð¾Ð²Ñ…Ð¾Ð¶Ð´ÐµÐ½Ð¸Ð¹ ÑÑ„Ð¾Ñ€Ð¼Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒÐ¿Ð¾Ð·Ð¸Ñ†Ð¸ÑŽÐ´Ð¾ÐºÑƒÐ¼ÐµÐ½Ñ‚Ð° ÑÑ‡ÐµÑ‚Ð¿Ð¾ÐºÐ¾Ð´Ñƒ Ñ‚ÐµÐºÑƒÑ‰Ð°ÑÐ´Ð°Ñ‚Ð° Ñ‚ÐµÐºÑƒÑ‰ÐµÐµÐ²Ñ€ÐµÐ¼Ñ Ñ‚Ð¸Ð¿Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ Ñ‚Ð¸Ð¿Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÑÑÑ‚Ñ€ ÑƒÐ´Ð°Ð»Ð¸Ñ‚ÑŒÐ¾Ð±ÑŠÐµÐºÑ‚Ñ‹ ÑƒÑÑ‚Ð°Ð½Ð¾Ð²Ð¸Ñ‚ÑŒÑ‚Ð°Ð½Ð° ÑƒÑÑ‚Ð°Ð½Ð¾Ð²Ð¸Ñ‚ÑŒÑ‚Ð°Ð¿Ð¾ Ñ„Ð¸ÐºÑÑˆÐ°Ð±Ð»Ð¾Ð½ Ñ„Ð¾Ñ€Ð¼Ð°Ñ‚ Ñ†ÐµÐ» ÑˆÐ°Ð±Ð»Ð¾Ð½\";var a={cN:\"dquote\",b:'\"\"'};var d={cN:\"string\",b:'\"',e:'\"|$',c:[a],r:0};var g={cN:\"string\",b:\"\\\\|\",e:'\"|$',c:[a]};return{cI:true,l:f,k:{keyword:c,built_in:e},c:[b.CLCM,b.NM,d,g,{cN:\"function\",b:\"(Ð¿Ñ€Ð¾Ñ†ÐµÐ´ÑƒÑ€Ð°|Ñ„ÑƒÐ½ÐºÑ†Ð¸Ñ)\",e:\"$\",l:f,k:\"Ð¿Ñ€Ð¾Ñ†ÐµÐ´ÑƒÑ€Ð° Ñ„ÑƒÐ½ÐºÑ†Ð¸Ñ\",c:[{cN:\"title\",b:f},{cN:\"tail\",eW:true,c:[{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",l:f,k:\"Ð·Ð½Ð°Ñ‡\",c:[d,g]},{cN:\"export\",b:\"ÑÐºÑÐ¿Ð¾Ñ€Ñ‚\",eW:true,l:f,k:\"ÑÐºÑÐ¿Ð¾Ñ€Ñ‚\",c:[b.CLCM]}]},b.CLCM]},{cN:\"preprocessor\",b:\"#\",e:\"$\"},{cN:\"date\",b:\"'\\\\d{2}\\\\.\\\\d{2}\\\\.(\\\\d{2}|\\\\d{4})'\"}]}}(hljs);hljs.LANGUAGES.python=function(a){var f={cN:\"prompt\",b:\"^(>>>|\\\\.\\\\.\\\\.) \"};var c=[{cN:\"string\",b:\"(u|b)?r?'''\",e:\"'''\",c:[f],r:10},{cN:\"string\",b:'(u|b)?r?\"\"\"',e:'\"\"\"',c:[f],r:10},{cN:\"string\",b:\"(u|r|ur)'\",e:\"'\",c:[a.BE],r:10},{cN:\"string\",b:'(u|r|ur)\"',e:'\"',c:[a.BE],r:10},{cN:\"string\",b:\"(b|br)'\",e:\"'\",c:[a.BE]},{cN:\"string\",b:'(b|br)\"',e:'\"',c:[a.BE]}].concat([a.ASM,a.QSM]);var e={cN:\"title\",b:a.UIR};var d={cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",c:[\"self\",a.CNM,f].concat(c)};var b={bWK:true,e:\":\",i:\"[${=;\\\\n]\",c:[e,d],r:10};return{k:{keyword:\"and elif is global as in if from raise for except finally print import pass return exec else break not with class assert yield try while continue del or def lambda nonlocal|10\",built_in:\"None True False Ellipsis NotImplemented\"},i:\"(</|->|\\\\?)\",c:c.concat([f,a.HCM,a.inherit(b,{cN:\"function\",k:\"def\"}),a.inherit(b,{cN:\"class\",k:\"class\"}),a.CNM,{cN:\"decorator\",b:\"@\",e:\"$\"},{b:\"\\\\b(print|exec)\\\\(\"}])}}(hljs);hljs.LANGUAGES.smalltalk=function(a){var b=\"[a-z][a-zA-Z0-9_]*\";var d={cN:\"char\",b:\"\\\\$.{1}\"};var c={cN:\"symbol\",b:\"#\"+a.UIR};return{k:\"self super nil true false thisContext\",c:[{cN:\"comment\",b:'\"',e:'\"',r:0},a.ASM,{cN:\"class\",b:\"\\\\b[A-Z][A-Za-z0-9_]*\",r:0},{cN:\"method\",b:b+\":\"},a.CNM,c,d,{cN:\"localvars\",b:\"\\\\|\\\\s*((\"+b+\")\\\\s*)+\\\\|\"},{cN:\"array\",b:\"\\\\#\\\\(\",e:\"\\\\)\",c:[a.ASM,d,a.CNM,c]}]}}(hljs);hljs.LANGUAGES.tex=function(a){var d={cN:\"command\",b:\"\\\\\\\\[a-zA-ZÐ°-ÑÐ-Ñ]+[\\\\*]?\"};var c={cN:\"command\",b:\"\\\\\\\\[^a-zA-ZÐ°-ÑÐ-Ñ0-9]\"};var b={cN:\"special\",b:\"[{}\\\\[\\\\]\\\\&#~]\",r:0};return{c:[{b:\"\\\\\\\\[a-zA-ZÐ°-ÑÐ-Ñ]+[\\\\*]? *= *-?\\\\d*\\\\.?\\\\d+(pt|pc|mm|cm|in|dd|cc|ex|em)?\",rB:true,c:[d,c,{cN:\"number\",b:\" *=\",e:\"-?\\\\d*\\\\.?\\\\d+(pt|pc|mm|cm|in|dd|cc|ex|em)?\",eB:true}],r:10},d,c,b,{cN:\"formula\",b:\"\\\\$\\\\$\",e:\"\\\\$\\\\$\",c:[d,c,b],r:0},{cN:\"formula\",b:\"\\\\$\",e:\"\\\\$\",c:[d,c,b],r:0},{cN:\"comment\",b:\"%\",e:\"$\",r:0}]}}(hljs);hljs.LANGUAGES.actionscript=function(a){var d=\"[a-zA-Z_$][a-zA-Z0-9_$]*\";var c=\"([*]|[a-zA-Z_$][a-zA-Z0-9_$]*)\";var e={cN:\"rest_arg\",b:\"[.]{3}\",e:d,r:10};var b={cN:\"title\",b:d};return{k:{keyword:\"as break case catch class const continue default delete do dynamic each else extends final finally for function get if implements import in include instanceof interface internal is namespace native new override package private protected public return set static super switch this throw try typeof use var void while with\",literal:\"true false null undefined\"},c:[a.ASM,a.QSM,a.CLCM,a.CBLCLM,a.CNM,{cN:\"package\",bWK:true,e:\"{\",k:\"package\",c:[b]},{cN:\"class\",bWK:true,e:\"{\",k:\"class interface\",c:[{bWK:true,k:\"extends implements\"},b]},{cN:\"preprocessor\",bWK:true,e:\";\",k:\"import include\"},{cN:\"function\",bWK:true,e:\"[{;]\",k:\"function\",i:\"\\\\S\",c:[b,{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",c:[a.ASM,a.QSM,a.CLCM,a.CBLCLM,e]},{cN:\"type\",b:\":\",e:c,r:10}]}]}}(hljs);hljs.LANGUAGES.sql=function(a){return{cI:true,c:[{cN:\"operator\",b:\"(begin|start|commit|rollback|savepoint|lock|alter|create|drop|rename|call|delete|do|handler|insert|load|replace|select|truncate|update|set|show|pragma|grant)\\\\b(?!:)\",e:\";\",eW:true,k:{keyword:\"all partial global month current_timestamp using go revoke smallint indicator end-exec disconnect zone with character assertion to add current_user usage input local alter match collate real then rollback get read timestamp session_user not integer bit unique day minute desc insert execute like ilike|2 level decimal drop continue isolation found where constraints domain right national some module transaction relative second connect escape close system_user for deferred section cast current sqlstate allocate intersect deallocate numeric public preserve full goto initially asc no key output collation group by union session both last language constraint column of space foreign deferrable prior connection unknown action commit view or first into float year primary cascaded except restrict set references names table outer open select size are rows from prepare distinct leading create only next inner authorization schema corresponding option declare precision immediate else timezone_minute external varying translation true case exception join hour default double scroll value cursor descriptor values dec fetch procedure delete and false int is describe char as at in varchar null trailing any absolute current_time end grant privileges when cross check write current_date pad begin temporary exec time update catalog user sql date on identity timezone_hour natural whenever interval work order cascade diagnostics nchar having left call do handler load replace truncate start lock show pragma exists number\",aggregate:\"count sum min max avg\"},c:[{cN:\"string\",b:\"'\",e:\"'\",c:[a.BE,{b:\"''\"}],r:0},{cN:\"string\",b:'\"',e:'\"',c:[a.BE,{b:'\"\"'}],r:0},{cN:\"string\",b:\"`\",e:\"`\",c:[a.BE]},a.CNM]},a.CBLCLM,{cN:\"comment\",b:\"--\",e:\"$\"}]}}(hljs);hljs.LANGUAGES.vala=function(a){return{k:{keyword:\"char uchar unichar int uint long ulong short ushort int8 int16 int32 int64 uint8 uint16 uint32 uint64 float double bool struct enum string void weak unowned owned async signal static abstract interface override while do for foreach else switch case break default return try catch public private protected internal using new this get set const stdout stdin stderr var\",built_in:\"DBus GLib CCode Gee Object\",literal:\"false true null\"},c:[{cN:\"class\",bWK:true,e:\"{\",k:\"class interface delegate namespace\",c:[{bWK:true,k:\"extends implements\"},{cN:\"title\",b:a.UIR}]},a.CLCM,a.CBLCLM,{cN:\"string\",b:'\"\"\"',e:'\"\"\"',r:5},a.ASM,a.QSM,a.CNM,{cN:\"preprocessor\",b:\"^#\",e:\"$\",r:2},{cN:\"constant\",b:\" [A-Z_]+ \",r:0}]}}(hljs);hljs.LANGUAGES.ini=function(a){return{cI:true,i:\"[^\\\\s]\",c:[{cN:\"comment\",b:\";\",e:\"$\"},{cN:\"title\",b:\"^\\\\[\",e:\"\\\\]\"},{cN:\"setting\",b:\"^[a-z0-9\\\\[\\\\]_-]+[ \\\\t]*=[ \\\\t]*\",e:\"$\",c:[{cN:\"value\",eW:true,k:\"on off true false yes no\",c:[a.QSM,a.NM]}]}]}}(hljs);hljs.LANGUAGES.d=function(x){var b={keyword:\"abstract alias align asm assert auto body break byte case cast catch class const continue debug default delete deprecated do else enum export extern final finally for foreach foreach_reverse|10 goto if immutable import in inout int interface invariant is lazy macro mixin module new nothrow out override package pragma private protected public pure ref return scope shared static struct super switch synchronized template this throw try typedef typeid typeof union unittest version void volatile while with __FILE__ __LINE__ __gshared|10 __thread __traits __DATE__ __EOF__ __TIME__ __TIMESTAMP__ __VENDOR__ __VERSION__\",built_in:\"bool cdouble cent cfloat char creal dchar delegate double dstring float function idouble ifloat ireal long real short string ubyte ucent uint ulong ushort wchar wstring\",literal:\"false null true\"};var c=\"(0|[1-9][\\\\d_]*)\",q=\"(0|[1-9][\\\\d_]*|\\\\d[\\\\d_]*|[\\\\d_]+?\\\\d)\",h=\"0[bB][01_]+\",v=\"([\\\\da-fA-F][\\\\da-fA-F_]*|_[\\\\da-fA-F][\\\\da-fA-F_]*)\",y=\"0[xX]\"+v,p=\"([eE][+-]?\"+q+\")\",o=\"(\"+q+\"(\\\\.\\\\d*|\"+p+\")|\\\\d+\\\\.\"+q+q+\"|\\\\.\"+c+p+\"?)\",k=\"(0[xX](\"+v+\"\\\\.\"+v+\"|\\\\.?\"+v+\")[pP][+-]?\"+q+\")\",l=\"(\"+c+\"|\"+h+\"|\"+y+\")\",n=\"(\"+k+\"|\"+o+\")\";var z=\"\\\\\\\\(['\\\"\\\\?\\\\\\\\abfnrtv]|u[\\\\dA-Fa-f]{4}|[0-7]{1,3}|x[\\\\dA-Fa-f]{2}|U[\\\\dA-Fa-f]{8})|&[a-zA-Z\\\\d]{2,};\";var m={cN:\"number\",b:\"\\\\b\"+l+\"(L|u|U|Lu|LU|uL|UL)?\",r:0};var j={cN:\"number\",b:\"\\\\b(\"+n+\"([fF]|L|i|[fF]i|Li)?|\"+l+\"(i|[fF]i|Li))\",r:0};var s={cN:\"string\",b:\"'(\"+z+\"|.)\",e:\"'\",i:\".\"};var r={b:z,r:0};var w={cN:\"string\",b:'\"',c:[r],e:'\"[cwd]?',r:0};var f={cN:\"string\",b:'[rq]\"',e:'\"[cwd]?',r:5};var u={cN:\"string\",b:\"`\",e:\"`[cwd]?\"};var i={cN:\"string\",b:'x\"[\\\\da-fA-F\\\\s\\\\n\\\\r]*\"[cwd]?',r:10};var t={cN:\"string\",b:'q\"\\\\{',e:'\\\\}\"'};var e={cN:\"shebang\",b:\"^#!\",e:\"$\",r:5};var g={cN:\"preprocessor\",b:\"#(line)\",e:\"$\",r:5};var d={cN:\"keyword\",b:\"@[a-zA-Z_][a-zA-Z_\\\\d]*\"};var a={cN:\"comment\",b:\"\\\\/\\\\+\",c:[\"self\"],e:\"\\\\+\\\\/\",r:10};return{l:x.UIR,k:b,c:[x.CLCM,x.CBLCLM,a,i,w,f,u,t,j,m,s,e,g,d]}}(hljs);hljs.LANGUAGES.axapta=function(a){return{k:\"false int abstract private char interface boolean static null if for true while long throw finally protected extends final implements return void enum else break new catch byte super class case short default double public try this switch continue reverse firstfast firstonly forupdate nofetch sum avg minof maxof count order group by asc desc index hint like dispaly edit client server ttsbegin ttscommit str real date container anytype common div mod\",c:[a.CLCM,a.CBLCLM,a.ASM,a.QSM,a.CNM,{cN:\"preprocessor\",b:\"#\",e:\"$\"},{cN:\"class\",bWK:true,e:\"{\",i:\":\",k:\"class interface\",c:[{cN:\"inheritance\",bWK:true,k:\"extends implements\",r:10},{cN:\"title\",b:a.UIR}]}]}}(hljs);hljs.LANGUAGES.perl=function(e){var a=\"getpwent getservent quotemeta msgrcv scalar kill dbmclose undef lc ma syswrite tr send umask sysopen shmwrite vec qx utime local oct semctl localtime readpipe do return format read sprintf dbmopen pop getpgrp not getpwnam rewinddir qqfileno qw endprotoent wait sethostent bless s|0 opendir continue each sleep endgrent shutdown dump chomp connect getsockname die socketpair close flock exists index shmgetsub for endpwent redo lstat msgctl setpgrp abs exit select print ref gethostbyaddr unshift fcntl syscall goto getnetbyaddr join gmtime symlink semget splice x|0 getpeername recv log setsockopt cos last reverse gethostbyname getgrnam study formline endhostent times chop length gethostent getnetent pack getprotoent getservbyname rand mkdir pos chmod y|0 substr endnetent printf next open msgsnd readdir use unlink getsockopt getpriority rindex wantarray hex system getservbyport endservent int chr untie rmdir prototype tell listen fork shmread ucfirst setprotoent else sysseek link getgrgid shmctl waitpid unpack getnetbyname reset chdir grep split require caller lcfirst until warn while values shift telldir getpwuid my getprotobynumber delete and sort uc defined srand accept package seekdir getprotobyname semop our rename seek if q|0 chroot sysread setpwent no crypt getc chown sqrt write setnetent setpriority foreach tie sin msgget map stat getlogin unless elsif truncate exec keys glob tied closedirioctl socket readlink eval xor readline binmode setservent eof ord bind alarm pipe atan2 getgrent exp time push setgrent gt lt or ne m|0 break given say state when\";var d={cN:\"subst\",b:\"[$@]\\\\{\",e:\"\\\\}\",k:a,r:10};var b={cN:\"variable\",b:\"\\\\$\\\\d\"};var i={cN:\"variable\",b:\"[\\\\$\\\\%\\\\@\\\\*](\\\\^\\\\w\\\\b|#\\\\w+(\\\\:\\\\:\\\\w+)*|[^\\\\s\\\\w{]|{\\\\w+}|\\\\w+(\\\\:\\\\:\\\\w*)*)\"};var f=[e.BE,d,b,i];var h={b:\"->\",c:[{b:e.IR},{b:\"{\",e:\"}\"}]};var g={cN:\"comment\",b:\"^(__END__|__DATA__)\",e:\"\\\\n$\",r:5};var c=[b,i,e.HCM,g,{cN:\"comment\",b:\"^\\\\=\\\\w\",e:\"\\\\=cut\",eW:true},h,{cN:\"string\",b:\"q[qwxr]?\\\\s*\\\\(\",e:\"\\\\)\",c:f,r:5},{cN:\"string\",b:\"q[qwxr]?\\\\s*\\\\[\",e:\"\\\\]\",c:f,r:5},{cN:\"string\",b:\"q[qwxr]?\\\\s*\\\\{\",e:\"\\\\}\",c:f,r:5},{cN:\"string\",b:\"q[qwxr]?\\\\s*\\\\|\",e:\"\\\\|\",c:f,r:5},{cN:\"string\",b:\"q[qwxr]?\\\\s*\\\\<\",e:\"\\\\>\",c:f,r:5},{cN:\"string\",b:\"qw\\\\s+q\",e:\"q\",c:f,r:5},{cN:\"string\",b:\"'\",e:\"'\",c:[e.BE],r:0},{cN:\"string\",b:'\"',e:'\"',c:f,r:0},{cN:\"string\",b:\"`\",e:\"`\",c:[e.BE]},{cN:\"string\",b:\"{\\\\w+}\",r:0},{cN:\"string\",b:\"-?\\\\w+\\\\s*\\\\=\\\\>\",r:0},{cN:\"number\",b:\"(\\\\b0[0-7_]+)|(\\\\b0x[0-9a-fA-F_]+)|(\\\\b[1-9][0-9_]*(\\\\.[0-9_]+)?)|[0_]\\\\b\",r:0},{b:\"(\"+e.RSR+\"|\\\\b(split|return|print|reverse|grep)\\\\b)\\\\s*\",k:\"split return print reverse grep\",r:0,c:[e.HCM,g,{cN:\"regexp\",b:\"(s|tr|y)/(\\\\\\\\.|[^/])*/(\\\\\\\\.|[^/])*/[a-z]*\",r:10},{cN:\"regexp\",b:\"(m|qr)?/\",e:\"/[a-z]*\",c:[e.BE],r:0}]},{cN:\"sub\",bWK:true,e:\"(\\\\s*\\\\(.*?\\\\))?[;{]\",k:\"sub\",r:5},{cN:\"operator\",b:\"-\\\\w\\\\b\",r:0}];d.c=c;h.c[1].c=c;return{k:a,c:c}}(hljs);hljs.LANGUAGES.scala=function(a){var c={cN:\"annotation\",b:\"@[A-Za-z]+\"};var b={cN:\"string\",b:'u?r?\"\"\"',e:'\"\"\"',r:10};return{k:\"type yield lazy override def with val var false true sealed abstract private trait object null if for while throw finally protected extends import final return else break new catch super class case package default try this match continue throws\",c:[{cN:\"javadoc\",b:\"/\\\\*\\\\*\",e:\"\\\\*/\",c:[{cN:\"javadoctag\",b:\"@[A-Za-z]+\"}],r:10},a.CLCM,a.CBLCLM,a.ASM,a.QSM,b,{cN:\"class\",b:\"((case )?class |object |trait )\",e:\"({|$)\",i:\":\",k:\"case class trait object\",c:[{bWK:true,k:\"extends with\",r:10},{cN:\"title\",b:a.UIR},{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",c:[a.ASM,a.QSM,b,c]}]},a.CNM,c]}}(hljs);hljs.LANGUAGES.cmake=function(a){return{cI:true,k:\"add_custom_command add_custom_target add_definitions add_dependencies add_executable add_library add_subdirectory add_test aux_source_directory break build_command cmake_minimum_required cmake_policy configure_file create_test_sourcelist define_property else elseif enable_language enable_testing endforeach endfunction endif endmacro endwhile execute_process export find_file find_library find_package find_path find_program fltk_wrap_ui foreach function get_cmake_property get_directory_property get_filename_component get_property get_source_file_property get_target_property get_test_property if include include_directories include_external_msproject include_regular_expression install link_directories load_cache load_command macro mark_as_advanced message option output_required_files project qt_wrap_cpp qt_wrap_ui remove_definitions return separate_arguments set set_directory_properties set_property set_source_files_properties set_target_properties set_tests_properties site_name source_group string target_link_libraries try_compile try_run unset variable_watch while build_name exec_program export_library_dependencies install_files install_programs install_targets link_libraries make_directory remove subdir_depends subdirs use_mangled_mesa utility_source variable_requires write_file\",c:[{cN:\"envvar\",b:\"\\\\${\",e:\"}\"},a.HCM,a.QSM,a.NM]}}(hljs);hljs.LANGUAGES.objectivec=function(a){var b={keyword:\"int float while private char catch export sizeof typedef const struct for union unsigned long volatile static protected bool mutable if public do return goto void enum else break extern class asm case short default double throw register explicit signed typename try this switch continue wchar_t inline readonly assign property protocol self synchronized end synthesize id optional required implementation nonatomic interface super unichar finally dynamic IBOutlet IBAction selector strong weak readonly\",literal:\"false true FALSE TRUE nil YES NO NULL\",built_in:\"NSString NSDictionary CGRect CGPoint UIButton UILabel UITextView UIWebView MKMapView UISegmentedControl NSObject UITableViewDelegate UITableViewDataSource NSThread UIActivityIndicator UITabbar UIToolBar UIBarButtonItem UIImageView NSAutoreleasePool UITableView BOOL NSInteger CGFloat NSException NSLog NSMutableString NSMutableArray NSMutableDictionary NSURL NSIndexPath CGSize UITableViewCell UIView UIViewController UINavigationBar UINavigationController UITabBarController UIPopoverController UIPopoverControllerDelegate UIImage NSNumber UISearchBar NSFetchedResultsController NSFetchedResultsChangeType UIScrollView UIScrollViewDelegate UIEdgeInsets UIColor UIFont UIApplication NSNotFound NSNotificationCenter NSNotification UILocalNotification NSBundle NSFileManager NSTimeInterval NSDate NSCalendar NSUserDefaults UIWindow NSRange NSArray NSError NSURLRequest NSURLConnection class UIInterfaceOrientation MPMoviePlayerController dispatch_once_t dispatch_queue_t dispatch_sync dispatch_async dispatch_once\"};return{k:b,i:\"</\",c:[a.CLCM,a.CBLCLM,a.CNM,a.QSM,{cN:\"string\",b:\"'\",e:\"[^\\\\\\\\]'\",i:\"[^\\\\\\\\][^']\"},{cN:\"preprocessor\",b:\"#import\",e:\"$\",c:[{cN:\"title\",b:'\"',e:'\"'},{cN:\"title\",b:\"<\",e:\">\"}]},{cN:\"preprocessor\",b:\"#\",e:\"$\"},{cN:\"class\",bWK:true,e:\"({|$)\",k:\"interface class protocol implementation\",c:[{cN:\"id\",b:a.UIR}]},{cN:\"variable\",b:\"\\\\.\"+a.UIR}]}}(hljs);hljs.LANGUAGES.avrasm=function(a){return{cI:true,k:{keyword:\"adc add adiw and andi asr bclr bld brbc brbs brcc brcs break breq brge brhc brhs brid brie brlo brlt brmi brne brpl brsh brtc brts brvc brvs bset bst call cbi cbr clc clh cli cln clr cls clt clv clz com cp cpc cpi cpse dec eicall eijmp elpm eor fmul fmuls fmulsu icall ijmp in inc jmp ld ldd ldi lds lpm lsl lsr mov movw mul muls mulsu neg nop or ori out pop push rcall ret reti rjmp rol ror sbc sbr sbrc sbrs sec seh sbi sbci sbic sbis sbiw sei sen ser ses set sev sez sleep spm st std sts sub subi swap tst wdr\",built_in:\"r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 r16 r17 r18 r19 r20 r21 r22 r23 r24 r25 r26 r27 r28 r29 r30 r31 x|0 xh xl y|0 yh yl z|0 zh zl ucsr1c udr1 ucsr1a ucsr1b ubrr1l ubrr1h ucsr0c ubrr0h tccr3c tccr3a tccr3b tcnt3h tcnt3l ocr3ah ocr3al ocr3bh ocr3bl ocr3ch ocr3cl icr3h icr3l etimsk etifr tccr1c ocr1ch ocr1cl twcr twdr twar twsr twbr osccal xmcra xmcrb eicra spmcsr spmcr portg ddrg ping portf ddrf sreg sph spl xdiv rampz eicrb eimsk gimsk gicr eifr gifr timsk tifr mcucr mcucsr tccr0 tcnt0 ocr0 assr tccr1a tccr1b tcnt1h tcnt1l ocr1ah ocr1al ocr1bh ocr1bl icr1h icr1l tccr2 tcnt2 ocr2 ocdr wdtcr sfior eearh eearl eedr eecr porta ddra pina portb ddrb pinb portc ddrc pinc portd ddrd pind spdr spsr spcr udr0 ucsr0a ucsr0b ubrr0l acsr admux adcsr adch adcl porte ddre pine pinf\"},c:[a.CBLCLM,{cN:\"comment\",b:\";\",e:\"$\"},a.CNM,a.BNM,{cN:\"number\",b:\"\\\\b(\\\\$[a-zA-Z0-9]+|0o[0-7]+)\"},a.QSM,{cN:\"string\",b:\"'\",e:\"[^\\\\\\\\]'\",i:\"[^\\\\\\\\][^']\"},{cN:\"label\",b:\"^[A-Za-z0-9_.$]+:\"},{cN:\"preprocessor\",b:\"#\",e:\"$\"},{cN:\"preprocessor\",b:\"\\\\.[a-zA-Z]+\"},{cN:\"localvars\",b:\"@[0-9]+\"}]}}(hljs);hljs.LANGUAGES.vhdl=function(a){return{cI:true,k:{keyword:\"abs access after alias all and architecture array assert attribute begin block body buffer bus case component configuration constant context cover disconnect downto default else elsif end entity exit fairness file for force function generate generic group guarded if impure in inertial inout is label library linkage literal loop map mod nand new next nor not null of on open or others out package port postponed procedure process property protected pure range record register reject release rem report restrict restrict_guarantee return rol ror select sequence severity shared signal sla sll sra srl strong subtype then to transport type unaffected units until use variable vmode vprop vunit wait when while with xnor xor\",typename:\"boolean bit character severity_level integer time delay_length natural positive string bit_vector file_open_kind file_open_status std_ulogic std_ulogic_vector std_logic std_logic_vector unsigned signed boolean_vector integer_vector real_vector time_vector\"},i:\"{\",c:[a.CBLCLM,{cN:\"comment\",b:\"--\",e:\"$\"},a.QSM,a.CNM,{cN:\"literal\",b:\"'(U|X|0|1|Z|W|L|H|-)'\",c:[a.BE]},{cN:\"attribute\",b:\"'[A-Za-z](_?[A-Za-z0-9])*\",c:[a.BE]}]}}(hljs);hljs.LANGUAGES.coffeescript=function(c){var b={keyword:\"in if for while finally new do return else break catch instanceof throw try this switch continue typeof delete debugger super then unless until loop of by when and or is isnt not\",literal:\"true false null undefined yes no on off \",reserved:\"case default function var void with const let enum export import native __hasProp __extends __slice __bind __indexOf\"};var a=\"[A-Za-z$_][0-9A-Za-z$_]*\";var e={cN:\"title\",b:a};var d={cN:\"subst\",b:\"#\\\\{\",e:\"}\",k:b,c:[c.BNM,c.CNM]};return{k:b,c:[c.BNM,c.CNM,c.ASM,{cN:\"string\",b:'\"\"\"',e:'\"\"\"',c:[c.BE,d]},{cN:\"string\",b:'\"',e:'\"',c:[c.BE,d],r:0},{cN:\"comment\",b:\"###\",e:\"###\"},c.HCM,{cN:\"regexp\",b:\"///\",e:\"///\",c:[c.HCM]},{cN:\"regexp\",b:\"//[gim]*\"},{cN:\"regexp\",b:\"/\\\\S(\\\\\\\\.|[^\\\\n])*/[gim]*\"},{b:\"`\",e:\"`\",eB:true,eE:true,sL:\"javascript\"},{cN:\"function\",b:a+\"\\\\s*=\\\\s*(\\\\(.+\\\\))?\\\\s*[-=]>\",rB:true,c:[e,{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\"}]},{cN:\"class\",bWK:true,k:\"class\",e:\"$\",i:\":\",c:[{bWK:true,k:\"extends\",eW:true,i:\":\",c:[e]},e]},{cN:\"property\",b:\"@\"+a}]}}(hljs);hljs.LANGUAGES.nginx=function(b){var c=[{cN:\"variable\",b:\"\\\\$\\\\d+\"},{cN:\"variable\",b:\"\\\\${\",e:\"}\"},{cN:\"variable\",b:\"[\\\\$\\\\@]\"+b.UIR}];var a={eW:true,l:\"[a-z/_]+\",k:{built_in:\"on off yes no true false none blocked debug info notice warn error crit select break last permanent redirect kqueue rtsig epoll poll /dev/poll\"},r:0,i:\"=>\",c:[b.HCM,{cN:\"string\",b:'\"',e:'\"',c:[b.BE].concat(c),r:0},{cN:\"string\",b:\"'\",e:\"'\",c:[b.BE].concat(c),r:0},{cN:\"url\",b:\"([a-z]+):/\",e:\"\\\\s\",eW:true,eE:true},{cN:\"regexp\",b:\"\\\\s\\\\^\",e:\"\\\\s|{|;\",rE:true,c:[b.BE].concat(c)},{cN:\"regexp\",b:\"~\\\\*?\\\\s+\",e:\"\\\\s|{|;\",rE:true,c:[b.BE].concat(c)},{cN:\"regexp\",b:\"\\\\*(\\\\.[a-z\\\\-]+)+\",c:[b.BE].concat(c)},{cN:\"regexp\",b:\"([a-z\\\\-]+\\\\.)+\\\\*\",c:[b.BE].concat(c)},{cN:\"number\",b:\"\\\\b\\\\d{1,3}\\\\.\\\\d{1,3}\\\\.\\\\d{1,3}\\\\.\\\\d{1,3}(:\\\\d{1,5})?\\\\b\"},{cN:\"number\",b:\"\\\\b\\\\d+[kKmMgGdshdwy]*\\\\b\",r:0}].concat(c)};return{c:[b.HCM,{b:b.UIR+\"\\\\s\",e:\";|{\",rB:true,c:[{cN:\"title\",b:b.UIR,starts:a}]}],i:\"[^\\\\s\\\\}]\"}}(hljs);hljs.LANGUAGES[\"erlang-repl\"]=function(a){return{k:{special_functions:\"spawn spawn_link self\",reserved:\"after and andalso|10 band begin bnot bor bsl bsr bxor case catch cond div end fun if let not of or orelse|10 query receive rem try when xor\"},c:[{cN:\"prompt\",b:\"^[0-9]+> \",r:10},{cN:\"comment\",b:\"%\",e:\"$\"},{cN:\"number\",b:\"\\\\b(\\\\d+#[a-fA-F0-9]+|\\\\d+(\\\\.\\\\d+)?([eE][-+]?\\\\d+)?)\",r:0},a.ASM,a.QSM,{cN:\"constant\",b:\"\\\\?(::)?([A-Z]\\\\w*(::)?)+\"},{cN:\"arrow\",b:\"->\"},{cN:\"ok\",b:\"ok\"},{cN:\"exclamation_mark\",b:\"!\"},{cN:\"function_or_atom\",b:\"(\\\\b[a-z'][a-zA-Z0-9_']*:[a-z'][a-zA-Z0-9_']*)|(\\\\b[a-z'][a-zA-Z0-9_']*)\",r:0},{cN:\"variable\",b:\"[A-Z][a-zA-Z0-9_']*\",r:0}]}}(hljs);hljs.LANGUAGES.r=function(a){var b=\"([a-zA-Z]|\\\\.[a-zA-Z.])[a-zA-Z0-9._]*\";return{c:[a.HCM,{b:b,l:b,k:{keyword:\"function if in break next repeat else for return switch while try tryCatch|10 stop warning require library attach detach source setMethod setGeneric setGroupGeneric setClass ...|10\",literal:\"NULL NA TRUE FALSE T F Inf NaN NA_integer_|10 NA_real_|10 NA_character_|10 NA_complex_|10\"},r:0},{cN:\"number\",b:\"0[xX][0-9a-fA-F]+[Li]?\\\\b\",r:0},{cN:\"number\",b:\"\\\\d+(?:[eE][+\\\\-]?\\\\d*)?L\\\\b\",r:0},{cN:\"number\",b:\"\\\\d+\\\\.(?!\\\\d)(?:i\\\\b)?\",r:0},{cN:\"number\",b:\"\\\\d+(?:\\\\.\\\\d*)?(?:[eE][+\\\\-]?\\\\d*)?i?\\\\b\",r:0},{cN:\"number\",b:\"\\\\.\\\\d+(?:[eE][+\\\\-]?\\\\d*)?i?\\\\b\",r:0},{b:\"`\",e:\"`\",r:0},{cN:\"string\",b:'\"',e:'\"',c:[a.BE],r:0},{cN:\"string\",b:\"'\",e:\"'\",c:[a.BE],r:0}]}}(hljs);hljs.LANGUAGES.json=function(a){var e={literal:\"true false null\"};var d=[a.QSM,a.CNM];var c={cN:\"value\",e:\",\",eW:true,eE:true,c:d,k:e};var b={b:\"{\",e:\"}\",c:[{cN:\"attribute\",b:'\\\\s*\"',e:'\"\\\\s*:\\\\s*',eB:true,eE:true,c:[a.BE],i:\"\\\\n\",starts:c}],i:\"\\\\S\"};var f={b:\"\\\\[\",e:\"\\\\]\",c:[a.inherit(c,{cN:null})],i:\"\\\\S\"};d.splice(d.length,0,b,f);return{c:d,k:e,i:\"\\\\S\"}}(hljs);hljs.LANGUAGES.django=function(c){function e(h,g){return(g==undefined||(!h.cN&&g.cN==\"tag\")||h.cN==\"value\")}function f(l,k){var g={};for(var j in l){if(j!=\"contains\"){g[j]=l[j]}var m=[];for(var h=0;l.c&&h<l.c.length;h++){m.push(f(l.c[h],l))}if(e(l,k)){m=b.concat(m)}if(m.length){g.c=m}}return g}var d={cN:\"filter\",b:\"\\\\|[A-Za-z]+\\\\:?\",eE:true,k:\"truncatewords removetags linebreaksbr yesno get_digit timesince random striptags filesizeformat escape linebreaks length_is ljust rjust cut urlize fix_ampersands title floatformat capfirst pprint divisibleby add make_list unordered_list urlencode timeuntil urlizetrunc wordcount stringformat linenumbers slice date dictsort dictsortreversed default_if_none pluralize lower join center default truncatewords_html upper length phone2numeric wordwrap time addslashes slugify first escapejs force_escape iriencode last safe safeseq truncatechars localize unlocalize localtime utc timezone\",c:[{cN:\"argument\",b:'\"',e:'\"'}]};var b=[{cN:\"template_comment\",b:\"{%\\\\s*comment\\\\s*%}\",e:\"{%\\\\s*endcomment\\\\s*%}\"},{cN:\"template_comment\",b:\"{#\",e:\"#}\"},{cN:\"template_tag\",b:\"{%\",e:\"%}\",k:\"comment endcomment load templatetag ifchanged endifchanged if endif firstof for endfor in ifnotequal endifnotequal widthratio extends include spaceless endspaceless regroup by as ifequal endifequal ssi now with cycle url filter endfilter debug block endblock else autoescape endautoescape csrf_token empty elif endwith static trans blocktrans endblocktrans get_static_prefix get_media_prefix plural get_current_language language get_available_languages get_current_language_bidi get_language_info get_language_info_list localize endlocalize localtime endlocaltime timezone endtimezone get_current_timezone\",c:[d]},{cN:\"variable\",b:\"{{\",e:\"}}\",c:[d]}];var a=f(c.LANGUAGES.xml);a.cI=true;return a}(hljs);hljs.LANGUAGES.delphi=function(b){var f=\"and safecall cdecl then string exports library not pascal set virtual file in array label packed end. index while const raise for to implementation with except overload destructor downto finally program exit unit inherited override if type until function do begin repeat goto nil far initialization object else var uses external resourcestring interface end finalization class asm mod case on shr shl of register xorwrite threadvar try record near stored constructor stdcall inline div out or procedure\";var e=\"safecall stdcall pascal stored const implementation finalization except to finally program inherited override then exports string read not mod shr try div shl set library message packed index for near overload label downto exit public goto interface asm on of constructor or private array unit raise destructor var type until function else external with case default record while protected property procedure published and cdecl do threadvar file in if end virtual write far out begin repeat nil initialization object uses resourcestring class register xorwrite inline static\";var a={cN:\"comment\",b:\"{\",e:\"}\",r:0};var g={cN:\"comment\",b:\"\\\\(\\\\*\",e:\"\\\\*\\\\)\",r:10};var c={cN:\"string\",b:\"'\",e:\"'\",c:[{b:\"''\"}],r:0};var d={cN:\"string\",b:\"(#\\\\d+)+\"};var h={cN:\"function\",bWK:true,e:\"[:;]\",k:\"function constructor|10 destructor|10 procedure|10\",c:[{cN:\"title\",b:b.IR},{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",k:f,c:[c,d]},a,g]};return{cI:true,k:f,i:'(\"|\\\\$[G-Zg-z]|\\\\/\\\\*|</)',c:[a,g,b.CLCM,c,d,b.NM,h,{cN:\"class\",b:\"=\\\\bclass\\\\b\",e:\"end;\",k:e,c:[c,d,a,g,b.CLCM,h]}]}}(hljs);hljs.LANGUAGES.vbscript=function(a){return{cI:true,k:{keyword:\"call class const dim do loop erase execute executeglobal exit for each next function if then else on error option explicit new private property let get public randomize redim rem select case set stop sub while wend with end to elseif is or xor and not class_initialize class_terminate default preserve in me byval byref step resume goto\",built_in:\"lcase month vartype instrrev ubound setlocale getobject rgb getref string weekdayname rnd dateadd monthname now day minute isarray cbool round formatcurrency conversions csng timevalue second year space abs clng timeserial fixs len asc isempty maths dateserial atn timer isobject filter weekday datevalue ccur isdate instr datediff formatdatetime replace isnull right sgn array snumeric log cdbl hex chr lbound msgbox ucase getlocale cos cdate cbyte rtrim join hour oct typename trim strcomp int createobject loadpicture tan formatnumber mid scriptenginebuildversion scriptengine split scriptengineminorversion cint sin datepart ltrim sqr scriptenginemajorversion time derived eval date formatpercent exp inputbox left ascw chrw regexp server response request cstr err\",literal:\"true false null nothing empty\"},i:\"//\",c:[a.inherit(a.QSM,{c:[{b:'\"\"'}]}),{cN:\"comment\",b:\"'\",e:\"$\"},a.CNM]}}(hljs);hljs.LANGUAGES.mel=function(a){return{k:\"int float string vector matrix if else switch case default while do for in break continue global proc return about abs addAttr addAttributeEditorNodeHelp addDynamic addNewShelfTab addPP addPanelCategory addPrefixToName advanceToNextDrivenKey affectedNet affects aimConstraint air alias aliasAttr align alignCtx alignCurve alignSurface allViewFit ambientLight angle angleBetween animCone animCurveEditor animDisplay animView annotate appendStringArray applicationName applyAttrPreset applyTake arcLenDimContext arcLengthDimension arclen arrayMapper art3dPaintCtx artAttrCtx artAttrPaintVertexCtx artAttrSkinPaintCtx artAttrTool artBuildPaintMenu artFluidAttrCtx artPuttyCtx artSelectCtx artSetPaintCtx artUserPaintCtx assignCommand assignInputDevice assignViewportFactories attachCurve attachDeviceAttr attachSurface attrColorSliderGrp attrCompatibility attrControlGrp attrEnumOptionMenu attrEnumOptionMenuGrp attrFieldGrp attrFieldSliderGrp attrNavigationControlGrp attrPresetEditWin attributeExists attributeInfo attributeMenu attributeQuery autoKeyframe autoPlace bakeClip bakeFluidShading bakePartialHistory bakeResults bakeSimulation basename basenameEx batchRender bessel bevel bevelPlus binMembership bindSkin blend2 blendShape blendShapeEditor blendShapePanel blendTwoAttr blindDataType boneLattice boundary boxDollyCtx boxZoomCtx bufferCurve buildBookmarkMenu buildKeyframeMenu button buttonManip CBG cacheFile cacheFileCombine cacheFileMerge cacheFileTrack camera cameraView canCreateManip canvas capitalizeString catch catchQuiet ceil changeSubdivComponentDisplayLevel changeSubdivRegion channelBox character characterMap characterOutlineEditor characterize chdir checkBox checkBoxGrp checkDefaultRenderGlobals choice circle circularFillet clamp clear clearCache clip clipEditor clipEditorCurrentTimeCtx clipSchedule clipSchedulerOutliner clipTrimBefore closeCurve closeSurface cluster cmdFileOutput cmdScrollFieldExecuter cmdScrollFieldReporter cmdShell coarsenSubdivSelectionList collision color colorAtPoint colorEditor colorIndex colorIndexSliderGrp colorSliderButtonGrp colorSliderGrp columnLayout commandEcho commandLine commandPort compactHairSystem componentEditor compositingInterop computePolysetVolume condition cone confirmDialog connectAttr connectControl connectDynamic connectJoint connectionInfo constrain constrainValue constructionHistory container containsMultibyte contextInfo control convertFromOldLayers convertIffToPsd convertLightmap convertSolidTx convertTessellation convertUnit copyArray copyFlexor copyKey copySkinWeights cos cpButton cpCache cpClothSet cpCollision cpConstraint cpConvClothToMesh cpForces cpGetSolverAttr cpPanel cpProperty cpRigidCollisionFilter cpSeam cpSetEdit cpSetSolverAttr cpSolver cpSolverTypes cpTool cpUpdateClothUVs createDisplayLayer createDrawCtx createEditor createLayeredPsdFile createMotionField createNewShelf createNode createRenderLayer createSubdivRegion cross crossProduct ctxAbort ctxCompletion ctxEditMode ctxTraverse currentCtx currentTime currentTimeCtx currentUnit currentUnit curve curveAddPtCtx curveCVCtx curveEPCtx curveEditorCtx curveIntersect curveMoveEPCtx curveOnSurface curveSketchCtx cutKey cycleCheck cylinder dagPose date defaultLightListCheckBox defaultNavigation defineDataServer defineVirtualDevice deformer deg_to_rad delete deleteAttr deleteShadingGroupsAndMaterials deleteShelfTab deleteUI deleteUnusedBrushes delrandstr detachCurve detachDeviceAttr detachSurface deviceEditor devicePanel dgInfo dgdirty dgeval dgtimer dimWhen directKeyCtx directionalLight dirmap dirname disable disconnectAttr disconnectJoint diskCache displacementToPoly displayAffected displayColor displayCull displayLevelOfDetail displayPref displayRGBColor displaySmoothness displayStats displayString displaySurface distanceDimContext distanceDimension doBlur dolly dollyCtx dopeSheetEditor dot dotProduct doubleProfileBirailSurface drag dragAttrContext draggerContext dropoffLocator duplicate duplicateCurve duplicateSurface dynCache dynControl dynExport dynExpression dynGlobals dynPaintEditor dynParticleCtx dynPref dynRelEdPanel dynRelEditor dynamicLoad editAttrLimits editDisplayLayerGlobals editDisplayLayerMembers editRenderLayerAdjustment editRenderLayerGlobals editRenderLayerMembers editor editorTemplate effector emit emitter enableDevice encodeString endString endsWith env equivalent equivalentTol erf error eval eval evalDeferred evalEcho event exactWorldBoundingBox exclusiveLightCheckBox exec executeForEachObject exists exp expression expressionEditorListen extendCurve extendSurface extrude fcheck fclose feof fflush fgetline fgetword file fileBrowserDialog fileDialog fileExtension fileInfo filetest filletCurve filter filterCurve filterExpand filterStudioImport findAllIntersections findAnimCurves findKeyframe findMenuItem findRelatedSkinCluster finder firstParentOf fitBspline flexor floatEq floatField floatFieldGrp floatScrollBar floatSlider floatSlider2 floatSliderButtonGrp floatSliderGrp floor flow fluidCacheInfo fluidEmitter fluidVoxelInfo flushUndo fmod fontDialog fopen formLayout format fprint frameLayout fread freeFormFillet frewind fromNativePath fwrite gamma gauss geometryConstraint getApplicationVersionAsFloat getAttr getClassification getDefaultBrush getFileList getFluidAttr getInputDeviceRange getMayaPanelTypes getModifiers getPanel getParticleAttr getPluginResource getenv getpid glRender glRenderEditor globalStitch gmatch goal gotoBindPose grabColor gradientControl gradientControlNoAttr graphDollyCtx graphSelectContext graphTrackCtx gravity grid gridLayout group groupObjectsByName HfAddAttractorToAS HfAssignAS HfBuildEqualMap HfBuildFurFiles HfBuildFurImages HfCancelAFR HfConnectASToHF HfCreateAttractor HfDeleteAS HfEditAS HfPerformCreateAS HfRemoveAttractorFromAS HfSelectAttached HfSelectAttractors HfUnAssignAS hardenPointCurve hardware hardwareRenderPanel headsUpDisplay headsUpMessage help helpLine hermite hide hilite hitTest hotBox hotkey hotkeyCheck hsv_to_rgb hudButton hudSlider hudSliderButton hwReflectionMap hwRender hwRenderLoad hyperGraph hyperPanel hyperShade hypot iconTextButton iconTextCheckBox iconTextRadioButton iconTextRadioCollection iconTextScrollList iconTextStaticLabel ikHandle ikHandleCtx ikHandleDisplayScale ikSolver ikSplineHandleCtx ikSystem ikSystemInfo ikfkDisplayMethod illustratorCurves image imfPlugins inheritTransform insertJoint insertJointCtx insertKeyCtx insertKnotCurve insertKnotSurface instance instanceable instancer intField intFieldGrp intScrollBar intSlider intSliderGrp interToUI internalVar intersect iprEngine isAnimCurve isConnected isDirty isParentOf isSameObject isTrue isValidObjectName isValidString isValidUiName isolateSelect itemFilter itemFilterAttr itemFilterRender itemFilterType joint jointCluster jointCtx jointDisplayScale jointLattice keyTangent keyframe keyframeOutliner keyframeRegionCurrentTimeCtx keyframeRegionDirectKeyCtx keyframeRegionDollyCtx keyframeRegionInsertKeyCtx keyframeRegionMoveKeyCtx keyframeRegionScaleKeyCtx keyframeRegionSelectKeyCtx keyframeRegionSetKeyCtx keyframeRegionTrackCtx keyframeStats lassoContext lattice latticeDeformKeyCtx launch launchImageEditor layerButton layeredShaderPort layeredTexturePort layout layoutDialog lightList lightListEditor lightListPanel lightlink lineIntersection linearPrecision linstep listAnimatable listAttr listCameras listConnections listDeviceAttachments listHistory listInputDeviceAxes listInputDeviceButtons listInputDevices listMenuAnnotation listNodeTypes listPanelCategories listRelatives listSets listTransforms listUnselected listerEditor loadFluid loadNewShelf loadPlugin loadPluginLanguageResources loadPrefObjects localizedPanelLabel lockNode loft log longNameOf lookThru ls lsThroughFilter lsType lsUI Mayatomr mag makeIdentity makeLive makePaintable makeRoll makeSingleSurface makeTubeOn makebot manipMoveContext manipMoveLimitsCtx manipOptions manipRotateContext manipRotateLimitsCtx manipScaleContext manipScaleLimitsCtx marker match max memory menu menuBarLayout menuEditor menuItem menuItemToShelf menuSet menuSetPref messageLine min minimizeApp mirrorJoint modelCurrentTimeCtx modelEditor modelPanel mouse movIn movOut move moveIKtoFK moveKeyCtx moveVertexAlongDirection multiProfileBirailSurface mute nParticle nameCommand nameField namespace namespaceInfo newPanelItems newton nodeCast nodeIconButton nodeOutliner nodePreset nodeType noise nonLinear normalConstraint normalize nurbsBoolean nurbsCopyUVSet nurbsCube nurbsEditUV nurbsPlane nurbsSelect nurbsSquare nurbsToPoly nurbsToPolygonsPref nurbsToSubdiv nurbsToSubdivPref nurbsUVSet nurbsViewDirectionVector objExists objectCenter objectLayer objectType objectTypeUI obsoleteProc oceanNurbsPreviewPlane offsetCurve offsetCurveOnSurface offsetSurface openGLExtension openMayaPref optionMenu optionMenuGrp optionVar orbit orbitCtx orientConstraint outlinerEditor outlinerPanel overrideModifier paintEffectsDisplay pairBlend palettePort paneLayout panel panelConfiguration panelHistory paramDimContext paramDimension paramLocator parent parentConstraint particle particleExists particleInstancer particleRenderInfo partition pasteKey pathAnimation pause pclose percent performanceOptions pfxstrokes pickWalk picture pixelMove planarSrf plane play playbackOptions playblast plugAttr plugNode pluginInfo pluginResourceUtil pointConstraint pointCurveConstraint pointLight pointMatrixMult pointOnCurve pointOnSurface pointPosition poleVectorConstraint polyAppend polyAppendFacetCtx polyAppendVertex polyAutoProjection polyAverageNormal polyAverageVertex polyBevel polyBlendColor polyBlindData polyBoolOp polyBridgeEdge polyCacheMonitor polyCheck polyChipOff polyClipboard polyCloseBorder polyCollapseEdge polyCollapseFacet polyColorBlindData polyColorDel polyColorPerVertex polyColorSet polyCompare polyCone polyCopyUV polyCrease polyCreaseCtx polyCreateFacet polyCreateFacetCtx polyCube polyCut polyCutCtx polyCylinder polyCylindricalProjection polyDelEdge polyDelFacet polyDelVertex polyDuplicateAndConnect polyDuplicateEdge polyEditUV polyEditUVShell polyEvaluate polyExtrudeEdge polyExtrudeFacet polyExtrudeVertex polyFlipEdge polyFlipUV polyForceUV polyGeoSampler polyHelix polyInfo polyInstallAction polyLayoutUV polyListComponentConversion polyMapCut polyMapDel polyMapSew polyMapSewMove polyMergeEdge polyMergeEdgeCtx polyMergeFacet polyMergeFacetCtx polyMergeUV polyMergeVertex polyMirrorFace polyMoveEdge polyMoveFacet polyMoveFacetUV polyMoveUV polyMoveVertex polyNormal polyNormalPerVertex polyNormalizeUV polyOptUvs polyOptions polyOutput polyPipe polyPlanarProjection polyPlane polyPlatonicSolid polyPoke polyPrimitive polyPrism polyProjection polyPyramid polyQuad polyQueryBlindData polyReduce polySelect polySelectConstraint polySelectConstraintMonitor polySelectCtx polySelectEditCtx polySeparate polySetToFaceNormal polySewEdge polyShortestPathCtx polySmooth polySoftEdge polySphere polySphericalProjection polySplit polySplitCtx polySplitEdge polySplitRing polySplitVertex polyStraightenUVBorder polySubdivideEdge polySubdivideFacet polyToSubdiv polyTorus polyTransfer polyTriangulate polyUVSet polyUnite polyWedgeFace popen popupMenu pose pow preloadRefEd print progressBar progressWindow projFileViewer projectCurve projectTangent projectionContext projectionManip promptDialog propModCtx propMove psdChannelOutliner psdEditTextureFile psdExport psdTextureFile putenv pwd python querySubdiv quit rad_to_deg radial radioButton radioButtonGrp radioCollection radioMenuItemCollection rampColorPort rand randomizeFollicles randstate rangeControl readTake rebuildCurve rebuildSurface recordAttr recordDevice redo reference referenceEdit referenceQuery refineSubdivSelectionList refresh refreshAE registerPluginResource rehash reloadImage removeJoint removeMultiInstance removePanelCategory rename renameAttr renameSelectionList renameUI render renderGlobalsNode renderInfo renderLayerButton renderLayerParent renderLayerPostProcess renderLayerUnparent renderManip renderPartition renderQualityNode renderSettings renderThumbnailUpdate renderWindowEditor renderWindowSelectContext renderer reorder reorderDeformers requires reroot resampleFluid resetAE resetPfxToPolyCamera resetTool resolutionNode retarget reverseCurve reverseSurface revolve rgb_to_hsv rigidBody rigidSolver roll rollCtx rootOf rot rotate rotationInterpolation roundConstantRadius rowColumnLayout rowLayout runTimeCommand runup sampleImage saveAllShelves saveAttrPreset saveFluid saveImage saveInitialState saveMenu savePrefObjects savePrefs saveShelf saveToolSettings scale scaleBrushBrightness scaleComponents scaleConstraint scaleKey scaleKeyCtx sceneEditor sceneUIReplacement scmh scriptCtx scriptEditorInfo scriptJob scriptNode scriptTable scriptToShelf scriptedPanel scriptedPanelType scrollField scrollLayout sculpt searchPathArray seed selLoadSettings select selectContext selectCurveCV selectKey selectKeyCtx selectKeyframeRegionCtx selectMode selectPref selectPriority selectType selectedNodes selectionConnection separator setAttr setAttrEnumResource setAttrMapping setAttrNiceNameResource setConstraintRestPosition setDefaultShadingGroup setDrivenKeyframe setDynamic setEditCtx setEditor setFluidAttr setFocus setInfinity setInputDeviceMapping setKeyCtx setKeyPath setKeyframe setKeyframeBlendshapeTargetWts setMenuMode setNodeNiceNameResource setNodeTypeFlag setParent setParticleAttr setPfxToPolyCamera setPluginResource setProject setStampDensity setStartupMessage setState setToolTo setUITemplate setXformManip sets shadingConnection shadingGeometryRelCtx shadingLightRelCtx shadingNetworkCompare shadingNode shapeCompare shelfButton shelfLayout shelfTabLayout shellField shortNameOf showHelp showHidden showManipCtx showSelectionInTitle showShadingGroupAttrEditor showWindow sign simplify sin singleProfileBirailSurface size sizeBytes skinCluster skinPercent smoothCurve smoothTangentSurface smoothstep snap2to2 snapKey snapMode snapTogetherCtx snapshot soft softMod softModCtx sort sound soundControl source spaceLocator sphere sphrand spotLight spotLightPreviewPort spreadSheetEditor spring sqrt squareSurface srtContext stackTrace startString startsWith stitchAndExplodeShell stitchSurface stitchSurfacePoints strcmp stringArrayCatenate stringArrayContains stringArrayCount stringArrayInsertAtIndex stringArrayIntersector stringArrayRemove stringArrayRemoveAtIndex stringArrayRemoveDuplicates stringArrayRemoveExact stringArrayToString stringToStringArray strip stripPrefixFromName stroke subdAutoProjection subdCleanTopology subdCollapse subdDuplicateAndConnect subdEditUV subdListComponentConversion subdMapCut subdMapSewMove subdMatchTopology subdMirror subdToBlind subdToPoly subdTransferUVsToCache subdiv subdivCrease subdivDisplaySmoothness substitute substituteAllString substituteGeometry substring surface surfaceSampler surfaceShaderList swatchDisplayPort switchTable symbolButton symbolCheckBox sysFile system tabLayout tan tangentConstraint texLatticeDeformContext texManipContext texMoveContext texMoveUVShellContext texRotateContext texScaleContext texSelectContext texSelectShortestPathCtx texSmudgeUVContext texWinToolCtx text textCurves textField textFieldButtonGrp textFieldGrp textManip textScrollList textToShelf textureDisplacePlane textureHairColor texturePlacementContext textureWindow threadCount threePointArcCtx timeControl timePort timerX toNativePath toggle toggleAxis toggleWindowVisibility tokenize tokenizeList tolerance tolower toolButton toolCollection toolDropped toolHasOptions toolPropertyWindow torus toupper trace track trackCtx transferAttributes transformCompare transformLimits translator trim trunc truncateFluidCache truncateHairCache tumble tumbleCtx turbulence twoPointArcCtx uiRes uiTemplate unassignInputDevice undo undoInfo ungroup uniform unit unloadPlugin untangleUV untitledFileName untrim upAxis updateAE userCtx uvLink uvSnapshot validateShelfName vectorize view2dToolCtx viewCamera viewClipPlane viewFit viewHeadOn viewLookAt viewManip viewPlace viewSet visor volumeAxis vortex waitCursor warning webBrowser webBrowserPrefs whatIs window windowPref wire wireContext workspace wrinkle wrinkleContext writeTake xbmLangPathList xform\",i:\"</\",c:[a.CNM,a.ASM,a.QSM,{cN:\"string\",b:\"`\",e:\"`\",c:[a.BE]},{cN:\"variable\",b:\"\\\\$\\\\d\",r:5},{cN:\"variable\",b:\"[\\\\$\\\\%\\\\@\\\\*](\\\\^\\\\w\\\\b|#\\\\w+|[^\\\\s\\\\w{]|{\\\\w+}|\\\\w+)\"},a.CLCM,a.CBLCLM]}}(hljs);hljs.LANGUAGES.dos=function(a){return{cI:true,k:{flow:\"if else goto for in do call exit not exist errorlevel defined equ neq lss leq gtr geq\",keyword:\"shift cd dir echo setlocal endlocal set pause copy\",stream:\"prn nul lpt3 lpt2 lpt1 con com4 com3 com2 com1 aux\",winutils:\"ping net ipconfig taskkill xcopy ren del\"},c:[{cN:\"envvar\",b:\"%%[^ ]\"},{cN:\"envvar\",b:\"%[^ ]+?%\"},{cN:\"envvar\",b:\"![^ ]+?!\"},{cN:\"number\",b:\"\\\\b\\\\d+\",r:0},{cN:\"comment\",b:\"@?rem\",e:\"$\"}]}}(hljs);hljs.LANGUAGES.apache=function(a){var b={cN:\"number\",b:\"[\\\\$%]\\\\d+\"};return{cI:true,k:{keyword:\"acceptfilter acceptmutex acceptpathinfo accessfilename action addalt addaltbyencoding addaltbytype addcharset adddefaultcharset adddescription addencoding addhandler addicon addiconbyencoding addiconbytype addinputfilter addlanguage addmoduleinfo addoutputfilter addoutputfilterbytype addtype alias aliasmatch allow allowconnect allowencodedslashes allowoverride anonymous anonymous_logemail anonymous_mustgiveemail anonymous_nouserid anonymous_verifyemail authbasicauthoritative authbasicprovider authdbduserpwquery authdbduserrealmquery authdbmgroupfile authdbmtype authdbmuserfile authdefaultauthoritative authdigestalgorithm authdigestdomain authdigestnccheck authdigestnonceformat authdigestnoncelifetime authdigestprovider authdigestqop authdigestshmemsize authgroupfile authldapbinddn authldapbindpassword authldapcharsetconfig authldapcomparednonserver authldapdereferencealiases authldapgroupattribute authldapgroupattributeisdn authldapremoteuserattribute authldapremoteuserisdn authldapurl authname authnprovideralias authtype authuserfile authzdbmauthoritative authzdbmtype authzdefaultauthoritative authzgroupfileauthoritative authzldapauthoritative authzownerauthoritative authzuserauthoritative balancermember browsermatch browsermatchnocase bufferedlogs cachedefaultexpire cachedirlength cachedirlevels cachedisable cacheenable cachefile cacheignorecachecontrol cacheignoreheaders cacheignorenolastmod cacheignorequerystring cachelastmodifiedfactor cachemaxexpire cachemaxfilesize cacheminfilesize cachenegotiateddocs cacheroot cachestorenostore cachestoreprivate cgimapextension charsetdefault charsetoptions charsetsourceenc checkcaseonly checkspelling chrootdir contentdigest cookiedomain cookieexpires cookielog cookiename cookiestyle cookietracking coredumpdirectory customlog dav davdepthinfinity davgenericlockdb davlockdb davmintimeout dbdexptime dbdkeep dbdmax dbdmin dbdparams dbdpersist dbdpreparesql dbdriver defaulticon defaultlanguage defaulttype deflatebuffersize deflatecompressionlevel deflatefilternote deflatememlevel deflatewindowsize deny directoryindex directorymatch directoryslash documentroot dumpioinput dumpiologlevel dumpiooutput enableexceptionhook enablemmap enablesendfile errordocument errorlog example expiresactive expiresbytype expiresdefault extendedstatus extfilterdefine extfilteroptions fileetag filterchain filterdeclare filterprotocol filterprovider filtertrace forcelanguagepriority forcetype forensiclog gracefulshutdowntimeout group header headername hostnamelookups identitycheck identitychecktimeout imapbase imapdefault imapmenu include indexheadinsert indexignore indexoptions indexorderdefault indexstylesheet isapiappendlogtoerrors isapiappendlogtoquery isapicachefile isapifakeasync isapilognotsupported isapireadaheadbuffer keepalive keepalivetimeout languagepriority ldapcacheentries ldapcachettl ldapconnectiontimeout ldapopcacheentries ldapopcachettl ldapsharedcachefile ldapsharedcachesize ldaptrustedclientcert ldaptrustedglobalcert ldaptrustedmode ldapverifyservercert limitinternalrecursion limitrequestbody limitrequestfields limitrequestfieldsize limitrequestline limitxmlrequestbody listen listenbacklog loadfile loadmodule lockfile logformat loglevel maxclients maxkeepaliverequests maxmemfree maxrequestsperchild maxrequestsperthread maxspareservers maxsparethreads maxthreads mcachemaxobjectcount mcachemaxobjectsize mcachemaxstreamingbuffer mcacheminobjectsize mcacheremovalalgorithm mcachesize metadir metafiles metasuffix mimemagicfile minspareservers minsparethreads mmapfile mod_gzip_on mod_gzip_add_header_count mod_gzip_keep_workfiles mod_gzip_dechunk mod_gzip_min_http mod_gzip_minimum_file_size mod_gzip_maximum_file_size mod_gzip_maximum_inmem_size mod_gzip_temp_dir mod_gzip_item_include mod_gzip_item_exclude mod_gzip_command_version mod_gzip_can_negotiate mod_gzip_handle_methods mod_gzip_static_suffix mod_gzip_send_vary mod_gzip_update_static modmimeusepathinfo multiviewsmatch namevirtualhost noproxy nwssltrustedcerts nwsslupgradeable options order passenv pidfile protocolecho proxybadheader proxyblock proxydomain proxyerroroverride proxyftpdircharset proxyiobuffersize proxymaxforwards proxypass proxypassinterpolateenv proxypassmatch proxypassreverse proxypassreversecookiedomain proxypassreversecookiepath proxypreservehost proxyreceivebuffersize proxyremote proxyremotematch proxyrequests proxyset proxystatus proxytimeout proxyvia readmename receivebuffersize redirect redirectmatch redirectpermanent redirecttemp removecharset removeencoding removehandler removeinputfilter removelanguage removeoutputfilter removetype requestheader require rewritebase rewritecond rewriteengine rewritelock rewritelog rewriteloglevel rewritemap rewriteoptions rewriterule rlimitcpu rlimitmem rlimitnproc satisfy scoreboardfile script scriptalias scriptaliasmatch scriptinterpretersource scriptlog scriptlogbuffer scriptloglength scriptsock securelisten seerequesttail sendbuffersize serveradmin serveralias serverlimit servername serverpath serverroot serversignature servertokens setenv setenvif setenvifnocase sethandler setinputfilter setoutputfilter ssienableaccess ssiendtag ssierrormsg ssistarttag ssitimeformat ssiundefinedecho sslcacertificatefile sslcacertificatepath sslcadnrequestfile sslcadnrequestpath sslcarevocationfile sslcarevocationpath sslcertificatechainfile sslcertificatefile sslcertificatekeyfile sslciphersuite sslcryptodevice sslengine sslhonorciperorder sslmutex ssloptions sslpassphrasedialog sslprotocol sslproxycacertificatefile sslproxycacertificatepath sslproxycarevocationfile sslproxycarevocationpath sslproxyciphersuite sslproxyengine sslproxymachinecertificatefile sslproxymachinecertificatepath sslproxyprotocol sslproxyverify sslproxyverifydepth sslrandomseed sslrequire sslrequiressl sslsessioncache sslsessioncachetimeout sslusername sslverifyclient sslverifydepth startservers startthreads substitute suexecusergroup threadlimit threadsperchild threadstacksize timeout traceenable transferlog typesconfig unsetenv usecanonicalname usecanonicalphysicalport user userdir virtualdocumentroot virtualdocumentrootip virtualscriptalias virtualscriptaliasip win32disableacceptex xbithack\",literal:\"on off\"},c:[a.HCM,{cN:\"sqbracket\",b:\"\\\\s\\\\[\",e:\"\\\\]$\"},{cN:\"cbracket\",b:\"[\\\\$%]\\\\{\",e:\"\\\\}\",c:[\"self\",b]},b,{cN:\"tag\",b:\"</?\",e:\">\"},a.QSM]}}(hljs);hljs.LANGUAGES.applescript=function(a){var b=a.inherit(a.QSM,{i:\"\"});var e={cN:\"title\",b:a.UIR};var d={cN:\"params\",b:\"\\\\(\",e:\"\\\\)\",c:[\"self\",a.CNM,b]};var c=[{cN:\"comment\",b:\"--\",e:\"$\",},{cN:\"comment\",b:\"\\\\(\\\\*\",e:\"\\\\*\\\\)\",c:[\"self\",{b:\"--\",e:\"$\"}]},a.HCM];return{k:{keyword:\"about above after against and around as at back before beginning behind below beneath beside between but by considering contain contains continue copy div does eighth else end equal equals error every exit fifth first for fourth from front get given global if ignoring in into is it its last local me middle mod my ninth not of on onto or over prop property put ref reference repeat returning script second set seventh since sixth some tell tenth that the then third through thru timeout times to transaction try until where while whose with without\",constant:\"AppleScript false linefeed return pi quote result space tab true\",type:\"alias application boolean class constant date file integer list number real record string text\",command:\"activate beep count delay launch log offset read round run say summarize write\",property:\"character characters contents day frontmost id item length month name paragraph paragraphs rest reverse running time version weekday word words year\"},c:[b,a.CNM,{cN:\"type\",b:\"\\\\bPOSIX file\\\\b\"},{cN:\"command\",b:\"\\\\b(clipboard info|the clipboard|info for|list (disks|folder)|mount volume|path to|(close|open for) access|(get|set) eof|current date|do shell script|get volume settings|random number|set volume|system attribute|system info|time to GMT|(load|run|store) script|scripting components|ASCII (character|number)|localized string|choose (application|color|file|file name|folder|from list|remote application|URL)|display (alert|dialog))\\\\b|^\\\\s*return\\\\b\"},{cN:\"constant\",b:\"\\\\b(text item delimiters|current application|missing value)\\\\b\"},{cN:\"keyword\",b:\"\\\\b(apart from|aside from|instead of|out of|greater than|isn't|(doesn't|does not) (equal|come before|come after|contain)|(greater|less) than( or equal)?|(starts?|ends|begins?) with|contained by|comes (before|after)|a (ref|reference))\\\\b\"},{cN:\"property\",b:\"\\\\b(POSIX path|(date|time) string|quoted form)\\\\b\"},{cN:\"function_start\",bWK:true,k:\"on\",i:\"[${=;\\\\n]\",c:[e,d]}].concat(c)}}(hljs);hljs.LANGUAGES.cpp=function(a){var b={keyword:\"false int float while private char catch export virtual operator sizeof dynamic_cast|10 typedef const_cast|10 const struct for static_cast|10 union namespace unsigned long throw volatile static protected bool template mutable if public friend do return goto auto void enum else break new extern using true class asm case typeid short reinterpret_cast|10 default double register explicit signed typename try this switch continue wchar_t inline delete alignof char16_t char32_t constexpr decltype noexcept nullptr static_assert thread_local restrict _Bool complex\",built_in:\"std string cin cout cerr clog stringstream istringstream ostringstream auto_ptr deque list queue stack vector map set bitset multiset multimap unordered_set unordered_map unordered_multiset unordered_multimap array shared_ptr\"};return{k:b,i:\"</\",c:[a.CLCM,a.CBLCLM,a.QSM,{cN:\"string\",b:\"'\\\\\\\\?.\",e:\"'\",i:\".\"},{cN:\"number\",b:\"\\\\b(\\\\d+(\\\\.\\\\d*)?|\\\\.\\\\d+)(u|U|l|L|ul|UL|f|F)\"},a.CNM,{cN:\"preprocessor\",b:\"#\",e:\"$\"},{cN:\"stl_container\",b:\"\\\\b(deque|list|queue|stack|vector|map|set|bitset|multiset|multimap|unordered_map|unordered_set|unordered_multiset|unordered_multimap|array)\\\\s*<\",e:\">\",k:b,r:10,c:[\"self\"]}]}}(hljs);hljs.LANGUAGES.matlab=function(a){var b=[a.CNM,{cN:\"string\",b:\"'\",e:\"'\",c:[a.BE,{b:\"''\"}],r:0}];return{k:{keyword:\"break case catch classdef continue else elseif end enumerated events for function global if methods otherwise parfor persistent properties return spmd switch try while\",built_in:\"sin sind sinh asin asind asinh cos cosd cosh acos acosd acosh tan tand tanh atan atand atan2 atanh sec secd sech asec asecd asech csc cscd csch acsc acscd acsch cot cotd coth acot acotd acoth hypot exp expm1 log log1p log10 log2 pow2 realpow reallog realsqrt sqrt nthroot nextpow2 abs angle complex conj imag real unwrap isreal cplxpair fix floor ceil round mod rem sign airy besselj bessely besselh besseli besselk beta betainc betaln ellipj ellipke erf erfc erfcx erfinv expint gamma gammainc gammaln psi legendre cross dot factor isprime primes gcd lcm rat rats perms nchoosek factorial cart2sph cart2pol pol2cart sph2cart hsv2rgb rgb2hsv zeros ones eye repmat rand randn linspace logspace freqspace meshgrid accumarray size length ndims numel disp isempty isequal isequalwithequalnans cat reshape diag blkdiag tril triu fliplr flipud flipdim rot90 find sub2ind ind2sub bsxfun ndgrid permute ipermute shiftdim circshift squeeze isscalar isvector ans eps realmax realmin pi i inf nan isnan isinf isfinite j why compan gallery hadamard hankel hilb invhilb magic pascal rosser toeplitz vander wilkinson\"},i:'(//|\"|#|/\\\\*|\\\\s+/\\\\w+)',c:[{cN:\"function\",bWK:true,e:\"$\",k:\"function\",c:[{cN:\"title\",b:a.UIR},{cN:\"params\",b:\"\\\\(\",e:\"\\\\)\"},{cN:\"params\",b:\"\\\\[\",e:\"\\\\]\"}]},{cN:\"transposed_variable\",b:\"[a-zA-Z_][a-zA-Z_0-9]*('+[\\\\.']*|[\\\\.']+)\",e:\"\"},{cN:\"matrix\",b:\"\\\\[\",e:\"\\\\]'*[\\\\.']*\",c:b},{cN:\"cell\",b:\"\\\\{\",e:\"\\\\}'*[\\\\.']*\",c:b},{cN:\"comment\",b:\"\\\\%\",e:\"$\"}].concat(b)}}(hljs);hljs.LANGUAGES.parser3=function(a){return{sL:\"xml\",c:[{cN:\"comment\",b:\"^#\",e:\"$\"},{cN:\"comment\",b:\"\\\\^rem{\",e:\"}\",r:10,c:[{b:\"{\",e:\"}\",c:[\"self\"]}]},{cN:\"preprocessor\",b:\"^@(?:BASE|USE|CLASS|OPTIONS)$\",r:10},{cN:\"title\",b:\"@[\\\\w\\\\-]+\\\\[[\\\\w^;\\\\-]*\\\\](?:\\\\[[\\\\w^;\\\\-]*\\\\])?(?:.*)$\"},{cN:\"variable\",b:\"\\\\$\\\\{?[\\\\w\\\\-\\\\.\\\\:]+\\\\}?\"},{cN:\"keyword\",b:\"\\\\^[\\\\w\\\\-\\\\.\\\\:]+\"},{cN:\"number\",b:\"\\\\^#[0-9a-fA-F]+\"},a.CNM]}}(hljs);hljs.LANGUAGES.clojure=function(l){var e={built_in:\"def cond apply if-not if-let if not not= = &lt; < > &lt;= <= >= == + / * - rem quot neg? pos? delay? symbol? keyword? true? false? integer? empty? coll? list? set? ifn? fn? associative? sequential? sorted? counted? reversible? number? decimal? class? distinct? isa? float? rational? reduced? ratio? odd? even? char? seq? vector? string? map? nil? contains? zero? instance? not-every? not-any? libspec? -> ->> .. . inc compare do dotimes mapcat take remove take-while drop letfn drop-last take-last drop-while while intern condp case reduced cycle split-at split-with repeat replicate iterate range merge zipmap declare line-seq sort comparator sort-by dorun doall nthnext nthrest partition eval doseq await await-for let agent atom send send-off release-pending-sends add-watch mapv filterv remove-watch agent-error restart-agent set-error-handler error-handler set-error-mode! error-mode shutdown-agents quote var fn loop recur throw try monitor-enter monitor-exit defmacro defn defn- macroexpand macroexpand-1 for doseq dosync dotimes and or when when-not when-let comp juxt partial sequence memoize constantly complement identity assert peek pop doto proxy defstruct first rest cons defprotocol cast coll deftype defrecord last butlast sigs reify second ffirst fnext nfirst nnext defmulti defmethod meta with-meta ns in-ns create-ns import intern refer keys select-keys vals key val rseq name namespace promise into transient persistent! conj! assoc! dissoc! pop! disj! import use class type num float double short byte boolean bigint biginteger bigdec print-method print-dup throw-if throw printf format load compile get-in update-in pr pr-on newline flush read slurp read-line subvec with-open memfn time ns assert re-find re-groups rand-int rand mod locking assert-valid-fdecl alias namespace resolve ref deref refset swap! reset! set-validator! compare-and-set! alter-meta! reset-meta! commute get-validator alter ref-set ref-history-count ref-min-history ref-max-history ensure sync io! new next conj set! memfn to-array future future-call into-array aset gen-class reduce merge map filter find empty hash-map hash-set sorted-map sorted-map-by sorted-set sorted-set-by vec vector seq flatten reverse assoc dissoc list disj get union difference intersection extend extend-type extend-protocol int nth delay count concat chunk chunk-buffer chunk-append chunk-first chunk-rest max min dec unchecked-inc-int unchecked-inc unchecked-dec-inc unchecked-dec unchecked-negate unchecked-add-int unchecked-add unchecked-subtract-int unchecked-subtract chunk-next chunk-cons chunked-seq? prn vary-meta lazy-seq spread list* str find-keyword keyword symbol gensym force rationalize\"};var f=\"[a-zA-Z_0-9\\\\!\\\\.\\\\?\\\\-\\\\+\\\\*\\\\/\\\\<\\\\=\\\\>\\\\&\\\\#\\\\$';]+\";var a=\"[\\\\s:\\\\(\\\\{]+\\\\d+(\\\\.\\\\d+)?\";var d={cN:\"number\",b:a,r:0};var j={cN:\"string\",b:'\"',e:'\"',c:[l.BE],r:0};var o={cN:\"comment\",b:\";\",e:\"$\",r:0};var n={cN:\"collection\",b:\"[\\\\[\\\\{]\",e:\"[\\\\]\\\\}]\"};var c={cN:\"comment\",b:\"\\\\^\"+f};var b={cN:\"comment\",b:\"\\\\^\\\\{\",e:\"\\\\}\"};var h={cN:\"attribute\",b:\"[:]\"+f};var m={cN:\"list\",b:\"\\\\(\",e:\"\\\\)\",r:0};var g={eW:true,eE:true,k:{literal:\"true false nil\"},r:0};var i={k:e,l:f,cN:\"title\",b:f,starts:g};m.c=[{cN:\"comment\",b:\"comment\"},i];g.c=[m,j,c,b,o,h,n,d];n.c=[m,j,c,o,h,n,d];return{i:\"\\\\S\",c:[o,m]}}(hljs);hljs.LANGUAGES.go=function(a){var b={keyword:\"break default func interface select case map struct chan else goto package switch const fallthrough if range type continue for import return var go defer\",constant:\"true false iota nil\",typename:\"bool byte complex64 complex128 float32 float64 int8 int16 int32 int64 string uint8 uint16 uint32 uint64 int uint uintptr rune\",built_in:\"append cap close complex copy imag len make new panic print println real recover delete\"};return{k:b,i:\"</\",c:[a.CLCM,a.CBLCLM,a.QSM,{cN:\"string\",b:\"'\",e:\"[^\\\\\\\\]'\",r:0},{cN:\"string\",b:\"`\",e:\"`\"},{cN:\"number\",b:\"[^a-zA-Z_0-9](\\\\-|\\\\+)?\\\\d+(\\\\.\\\\d+|\\\\/\\\\d+)?((d|e|f|l|s)(\\\\+|\\\\-)?\\\\d+)?\",r:0},a.CNM]}}(hljs);module.exports=hljs;",
          "type": "blob"
        },
        "lib/marked": {
          "path": "lib/marked",
          "content": "/**\n * marked - a markdown parser\n * Copyright (c) 2011-2013, Christopher Jeffrey. (MIT Licensed)\n * https://github.com/chjj/marked\n */\n\n;(function() {\n\n/**\n * Block-Level Grammar\n */\n\nvar block = {\n  newline: /^\\n+/,\n  code: /^( {4}[^\\n]+\\n*)+/,\n  fences: noop,\n  hr: /^( *[-*_]){3,} *(?:\\n+|$)/,\n  heading: /^ *(#{1,6}) *([^\\n]+?) *#* *(?:\\n+|$)/,\n  nptable: noop,\n  lheading: /^([^\\n]+)\\n *(=|-){2,} *(?:\\n+|$)/,\n  blockquote: /^( *>[^\\n]+(\\n[^\\n]+)*\\n*)+/,\n  list: /^( *)(bull) [\\s\\S]+?(?:hr|\\n{2,}(?! )(?!\\1bull )\\n*|\\s*$)/,\n  html: /^ *(?:comment|closed|closing) *(?:\\n{2,}|\\s*$)/,\n  def: /^ *\\[([^\\]]+)\\]: *<?([^\\s>]+)>?(?: +[\"(]([^\\n]+)[\")])? *(?:\\n+|$)/,\n  table: noop,\n  paragraph: /^((?:[^\\n]+\\n?(?!hr|heading|lheading|blockquote|tag|def))+)\\n*/,\n  text: /^[^\\n]+/\n};\n\nblock.bullet = /(?:[*+-]|\\d+\\.)/;\nblock.item = /^( *)(bull) [^\\n]*(?:\\n(?!\\1bull )[^\\n]*)*/;\nblock.item = replace(block.item, 'gm')\n  (/bull/g, block.bullet)\n  ();\n\nblock.list = replace(block.list)\n  (/bull/g, block.bullet)\n  ('hr', /\\n+(?=(?: *[-*_]){3,} *(?:\\n+|$))/)\n  ();\n\nblock._tag = '(?!(?:'\n  + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code'\n  + '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo'\n  + '|span|br|wbr|ins|del|img)\\\\b)\\\\w+(?!:/|@)\\\\b';\n\nblock.html = replace(block.html)\n  ('comment', /<!--[\\s\\S]*?-->/)\n  ('closed', /<(tag)[\\s\\S]+?<\\/\\1>/)\n  ('closing', /<tag(?:\"[^\"]*\"|'[^']*'|[^'\">])*?>/)\n  (/tag/g, block._tag)\n  ();\n\nblock.paragraph = replace(block.paragraph)\n  ('hr', block.hr)\n  ('heading', block.heading)\n  ('lheading', block.lheading)\n  ('blockquote', block.blockquote)\n  ('tag', '<' + block._tag)\n  ('def', block.def)\n  ();\n\n/**\n * Normal Block Grammar\n */\n\nblock.normal = merge({}, block);\n\n/**\n * GFM Block Grammar\n */\n\nblock.gfm = merge({}, block.normal, {\n  fences: /^ *(`{3,}|~{3,}) *(\\S+)? *\\n([\\s\\S]+?)\\s*\\1 *(?:\\n+|$)/,\n  paragraph: /^/\n});\n\nblock.gfm.paragraph = replace(block.paragraph)\n  ('(?!', '(?!'\n    + block.gfm.fences.source.replace('\\\\1', '\\\\2') + '|'\n    + block.list.source.replace('\\\\1', '\\\\3') + '|')\n  ();\n\n/**\n * GFM + Tables Block Grammar\n */\n\nblock.tables = merge({}, block.gfm, {\n  nptable: /^ *(\\S.*\\|.*)\\n *([-:]+ *\\|[-| :]*)\\n((?:.*\\|.*(?:\\n|$))*)\\n*/,\n  table: /^ *\\|(.+)\\n *\\|( *[-:]+[-| :]*)\\n((?: *\\|.*(?:\\n|$))*)\\n*/\n});\n\n/**\n * Block Lexer\n */\n\nfunction Lexer(options) {\n  this.tokens = [];\n  this.tokens.links = {};\n  this.options = options || marked.defaults;\n  this.rules = block.normal;\n\n  if (this.options.gfm) {\n    if (this.options.tables) {\n      this.rules = block.tables;\n    } else {\n      this.rules = block.gfm;\n    }\n  }\n}\n\n/**\n * Expose Block Rules\n */\n\nLexer.rules = block;\n\n/**\n * Static Lex Method\n */\n\nLexer.lex = function(src, options) {\n  var lexer = new Lexer(options);\n  return lexer.lex(src);\n};\n\n/**\n * Preprocessing\n */\n\nLexer.prototype.lex = function(src) {\n  src = src\n    .replace(/\\r\\n|\\r/g, '\\n')\n    .replace(/\\t/g, '    ')\n    .replace(/\\u00a0/g, ' ')\n    .replace(/\\u2424/g, '\\n');\n\n  return this.token(src, true);\n};\n\n/**\n * Lexing\n */\n\nLexer.prototype.token = function(src, top) {\n  var src = src.replace(/^ +$/gm, '')\n    , next\n    , loose\n    , cap\n    , bull\n    , b\n    , item\n    , space\n    , i\n    , l;\n\n  while (src) {\n    // newline\n    if (cap = this.rules.newline.exec(src)) {\n      src = src.substring(cap[0].length);\n      if (cap[0].length > 1) {\n        this.tokens.push({\n          type: 'space'\n        });\n      }\n    }\n\n    // code\n    if (cap = this.rules.code.exec(src)) {\n      src = src.substring(cap[0].length);\n      cap = cap[0].replace(/^ {4}/gm, '');\n      this.tokens.push({\n        type: 'code',\n        text: !this.options.pedantic\n          ? cap.replace(/\\n+$/, '')\n          : cap\n      });\n      continue;\n    }\n\n    // fences (gfm)\n    if (cap = this.rules.fences.exec(src)) {\n      src = src.substring(cap[0].length);\n      this.tokens.push({\n        type: 'code',\n        lang: cap[2],\n        text: cap[3]\n      });\n      continue;\n    }\n\n    // heading\n    if (cap = this.rules.heading.exec(src)) {\n      src = src.substring(cap[0].length);\n      this.tokens.push({\n        type: 'heading',\n        depth: cap[1].length,\n        text: cap[2]\n      });\n      continue;\n    }\n\n    // table no leading pipe (gfm)\n    if (top && (cap = this.rules.nptable.exec(src))) {\n      src = src.substring(cap[0].length);\n\n      item = {\n        type: 'table',\n        header: cap[1].replace(/^ *| *\\| *$/g, '').split(/ *\\| */),\n        align: cap[2].replace(/^ *|\\| *$/g, '').split(/ *\\| */),\n        cells: cap[3].replace(/\\n$/, '').split('\\n')\n      };\n\n      for (i = 0; i < item.align.length; i++) {\n        if (/^ *-+: *$/.test(item.align[i])) {\n          item.align[i] = 'right';\n        } else if (/^ *:-+: *$/.test(item.align[i])) {\n          item.align[i] = 'center';\n        } else if (/^ *:-+ *$/.test(item.align[i])) {\n          item.align[i] = 'left';\n        } else {\n          item.align[i] = null;\n        }\n      }\n\n      for (i = 0; i < item.cells.length; i++) {\n        item.cells[i] = item.cells[i].split(/ *\\| */);\n      }\n\n      this.tokens.push(item);\n\n      continue;\n    }\n\n    // lheading\n    if (cap = this.rules.lheading.exec(src)) {\n      src = src.substring(cap[0].length);\n      this.tokens.push({\n        type: 'heading',\n        depth: cap[2] === '=' ? 1 : 2,\n        text: cap[1]\n      });\n      continue;\n    }\n\n    // hr\n    if (cap = this.rules.hr.exec(src)) {\n      src = src.substring(cap[0].length);\n      this.tokens.push({\n        type: 'hr'\n      });\n      continue;\n    }\n\n    // blockquote\n    if (cap = this.rules.blockquote.exec(src)) {\n      src = src.substring(cap[0].length);\n\n      this.tokens.push({\n        type: 'blockquote_start'\n      });\n\n      cap = cap[0].replace(/^ *> ?/gm, '');\n\n      // Pass `top` to keep the current\n      // \"toplevel\" state. This is exactly\n      // how markdown.pl works.\n      this.token(cap, top);\n\n      this.tokens.push({\n        type: 'blockquote_end'\n      });\n\n      continue;\n    }\n\n    // list\n    if (cap = this.rules.list.exec(src)) {\n      src = src.substring(cap[0].length);\n      bull = cap[2];\n\n      this.tokens.push({\n        type: 'list_start',\n        ordered: bull.length > 1\n      });\n\n      // Get each top-level item.\n      cap = cap[0].match(this.rules.item);\n\n      next = false;\n      l = cap.length;\n      i = 0;\n\n      for (; i < l; i++) {\n        item = cap[i];\n\n        // Remove the list item's bullet\n        // so it is seen as the next token.\n        space = item.length;\n        item = item.replace(/^ *([*+-]|\\d+\\.) +/, '');\n\n        // Outdent whatever the\n        // list item contains. Hacky.\n        if (~item.indexOf('\\n ')) {\n          space -= item.length;\n          item = !this.options.pedantic\n            ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')\n            : item.replace(/^ {1,4}/gm, '');\n        }\n\n        // Determine whether the next list item belongs here.\n        // Backpedal if it does not belong in this list.\n        if (this.options.smartLists && i !== l - 1) {\n          b = block.bullet.exec(cap[i + 1])[0];\n          if (bull !== b && !(bull.length > 1 && b.length > 1)) {\n            src = cap.slice(i + 1).join('\\n') + src;\n            i = l - 1;\n          }\n        }\n\n        // Determine whether item is loose or not.\n        // Use: /(^|\\n)(?! )[^\\n]+\\n\\n(?!\\s*$)/\n        // for discount behavior.\n        loose = next || /\\n\\n(?!\\s*$)/.test(item);\n        if (i !== l - 1) {\n          next = item.charAt(item.length - 1) === '\\n';\n          if (!loose) loose = next;\n        }\n\n        this.tokens.push({\n          type: loose\n            ? 'loose_item_start'\n            : 'list_item_start'\n        });\n\n        // Recurse.\n        this.token(item, false);\n\n        this.tokens.push({\n          type: 'list_item_end'\n        });\n      }\n\n      this.tokens.push({\n        type: 'list_end'\n      });\n\n      continue;\n    }\n\n    // html\n    if (cap = this.rules.html.exec(src)) {\n      src = src.substring(cap[0].length);\n      this.tokens.push({\n        type: this.options.sanitize\n          ? 'paragraph'\n          : 'html',\n        pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style',\n        text: cap[0]\n      });\n      continue;\n    }\n\n    // def\n    if (top && (cap = this.rules.def.exec(src))) {\n      src = src.substring(cap[0].length);\n      this.tokens.links[cap[1].toLowerCase()] = {\n        href: cap[2],\n        title: cap[3]\n      };\n      continue;\n    }\n\n    // table (gfm)\n    if (top && (cap = this.rules.table.exec(src))) {\n      src = src.substring(cap[0].length);\n\n      item = {\n        type: 'table',\n        header: cap[1].replace(/^ *| *\\| *$/g, '').split(/ *\\| */),\n        align: cap[2].replace(/^ *|\\| *$/g, '').split(/ *\\| */),\n        cells: cap[3].replace(/(?: *\\| *)?\\n$/, '').split('\\n')\n      };\n\n      for (i = 0; i < item.align.length; i++) {\n        if (/^ *-+: *$/.test(item.align[i])) {\n          item.align[i] = 'right';\n        } else if (/^ *:-+: *$/.test(item.align[i])) {\n          item.align[i] = 'center';\n        } else if (/^ *:-+ *$/.test(item.align[i])) {\n          item.align[i] = 'left';\n        } else {\n          item.align[i] = null;\n        }\n      }\n\n      for (i = 0; i < item.cells.length; i++) {\n        item.cells[i] = item.cells[i]\n          .replace(/^ *\\| *| *\\| *$/g, '')\n          .split(/ *\\| */);\n      }\n\n      this.tokens.push(item);\n\n      continue;\n    }\n\n    // top-level paragraph\n    if (top && (cap = this.rules.paragraph.exec(src))) {\n      src = src.substring(cap[0].length);\n      this.tokens.push({\n        type: 'paragraph',\n        text: cap[1].charAt(cap[1].length - 1) === '\\n'\n          ? cap[1].slice(0, -1)\n          : cap[1]\n      });\n      continue;\n    }\n\n    // text\n    if (cap = this.rules.text.exec(src)) {\n      // Top-level should never reach here.\n      src = src.substring(cap[0].length);\n      this.tokens.push({\n        type: 'text',\n        text: cap[0]\n      });\n      continue;\n    }\n\n    if (src) {\n      throw new\n        Error('Infinite loop on byte: ' + src.charCodeAt(0));\n    }\n  }\n\n  return this.tokens;\n};\n\n/**\n * Inline-Level Grammar\n */\n\nvar inline = {\n  escape: /^\\\\([\\\\`*{}\\[\\]()#+\\-.!_>])/,\n  autolink: /^<([^ >]+(@|:\\/)[^ >]+)>/,\n  url: noop,\n  tag: /^<!--[\\s\\S]*?-->|^<\\/?\\w+(?:\"[^\"]*\"|'[^']*'|[^'\">])*?>/,\n  link: /^!?\\[(inside)\\]\\(href\\)/,\n  reflink: /^!?\\[(inside)\\]\\s*\\[([^\\]]*)\\]/,\n  nolink: /^!?\\[((?:\\[[^\\]]*\\]|[^\\[\\]])*)\\]/,\n  strong: /^__([\\s\\S]+?)__(?!_)|^\\*\\*([\\s\\S]+?)\\*\\*(?!\\*)/,\n  em: /^\\b_((?:__|[\\s\\S])+?)_\\b|^\\*((?:\\*\\*|[\\s\\S])+?)\\*(?!\\*)/,\n  code: /^(`+)\\s*([\\s\\S]*?[^`])\\s*\\1(?!`)/,\n  br: /^ {2,}\\n(?!\\s*$)/,\n  del: noop,\n  text: /^[\\s\\S]+?(?=[\\\\<!\\[_*`]| {2,}\\n|$)/\n};\n\ninline._inside = /(?:\\[[^\\]]*\\]|[^\\[\\]]|\\](?=[^\\[]*\\]))*/;\ninline._href = /\\s*<?([\\s\\S]*?)>?(?:\\s+['\"]([\\s\\S]*?)['\"])?\\s*/;\n\ninline.link = replace(inline.link)\n  ('inside', inline._inside)\n  ('href', inline._href)\n  ();\n\ninline.reflink = replace(inline.reflink)\n  ('inside', inline._inside)\n  ();\n\n/**\n * Normal Inline Grammar\n */\n\ninline.normal = merge({}, inline);\n\n/**\n * Pedantic Inline Grammar\n */\n\ninline.pedantic = merge({}, inline.normal, {\n  strong: /^__(?=\\S)([\\s\\S]*?\\S)__(?!_)|^\\*\\*(?=\\S)([\\s\\S]*?\\S)\\*\\*(?!\\*)/,\n  em: /^_(?=\\S)([\\s\\S]*?\\S)_(?!_)|^\\*(?=\\S)([\\s\\S]*?\\S)\\*(?!\\*)/\n});\n\n/**\n * GFM Inline Grammar\n */\n\ninline.gfm = merge({}, inline.normal, {\n  escape: replace(inline.escape)('])', '~|])')(),\n  url: /^(https?:\\/\\/[^\\s<]+[^<.,:;\"')\\]\\s])/,\n  del: /^~~(?=\\S)([\\s\\S]*?\\S)~~/,\n  text: replace(inline.text)\n    (']|', '~]|')\n    ('|', '|https?://|')\n    ()\n});\n\n/**\n * GFM + Line Breaks Inline Grammar\n */\n\ninline.breaks = merge({}, inline.gfm, {\n  br: replace(inline.br)('{2,}', '*')(),\n  text: replace(inline.gfm.text)('{2,}', '*')()\n});\n\n/**\n * Inline Lexer & Compiler\n */\n\nfunction InlineLexer(links, options) {\n  this.options = options || marked.defaults;\n  this.links = links;\n  this.rules = inline.normal;\n\n  if (!this.links) {\n    throw new\n      Error('Tokens array requires a `links` property.');\n  }\n\n  if (this.options.gfm) {\n    if (this.options.breaks) {\n      this.rules = inline.breaks;\n    } else {\n      this.rules = inline.gfm;\n    }\n  } else if (this.options.pedantic) {\n    this.rules = inline.pedantic;\n  }\n}\n\n/**\n * Expose Inline Rules\n */\n\nInlineLexer.rules = inline;\n\n/**\n * Static Lexing/Compiling Method\n */\n\nInlineLexer.output = function(src, links, options) {\n  var inline = new InlineLexer(links, options);\n  return inline.output(src);\n};\n\n/**\n * Lexing/Compiling\n */\n\nInlineLexer.prototype.output = function(src) {\n  var out = ''\n    , link\n    , text\n    , href\n    , cap;\n\n  while (src) {\n    // escape\n    if (cap = this.rules.escape.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += cap[1];\n      continue;\n    }\n\n    // autolink\n    if (cap = this.rules.autolink.exec(src)) {\n      src = src.substring(cap[0].length);\n      if (cap[2] === '@') {\n        text = cap[1].charAt(6) === ':'\n          ? this.mangle(cap[1].substring(7))\n          : this.mangle(cap[1]);\n        href = this.mangle('mailto:') + text;\n      } else {\n        text = escape(cap[1]);\n        href = text;\n      }\n      out += '<a href=\"'\n        + href\n        + '\">'\n        + text\n        + '</a>';\n      continue;\n    }\n\n    // url (gfm)\n    if (cap = this.rules.url.exec(src)) {\n      src = src.substring(cap[0].length);\n      text = escape(cap[1]);\n      href = text;\n      out += '<a href=\"'\n        + href\n        + '\">'\n        + text\n        + '</a>';\n      continue;\n    }\n\n    // tag\n    if (cap = this.rules.tag.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += this.options.sanitize\n        ? escape(cap[0])\n        : cap[0];\n      continue;\n    }\n\n    // link\n    if (cap = this.rules.link.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += this.outputLink(cap, {\n        href: cap[2],\n        title: cap[3]\n      });\n      continue;\n    }\n\n    // reflink, nolink\n    if ((cap = this.rules.reflink.exec(src))\n        || (cap = this.rules.nolink.exec(src))) {\n      src = src.substring(cap[0].length);\n      link = (cap[2] || cap[1]).replace(/\\s+/g, ' ');\n      link = this.links[link.toLowerCase()];\n      if (!link || !link.href) {\n        out += cap[0].charAt(0);\n        src = cap[0].substring(1) + src;\n        continue;\n      }\n      out += this.outputLink(cap, link);\n      continue;\n    }\n\n    // strong\n    if (cap = this.rules.strong.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += '<strong>'\n        + this.output(cap[2] || cap[1])\n        + '</strong>';\n      continue;\n    }\n\n    // em\n    if (cap = this.rules.em.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += '<em>'\n        + this.output(cap[2] || cap[1])\n        + '</em>';\n      continue;\n    }\n\n    // code\n    if (cap = this.rules.code.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += '<code>'\n        + escape(cap[2], true)\n        + '</code>';\n      continue;\n    }\n\n    // br\n    if (cap = this.rules.br.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += '<br>';\n      continue;\n    }\n\n    // del (gfm)\n    if (cap = this.rules.del.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += '<del>'\n        + this.output(cap[1])\n        + '</del>';\n      continue;\n    }\n\n    // text\n    if (cap = this.rules.text.exec(src)) {\n      src = src.substring(cap[0].length);\n      out += escape(this.smartypants(cap[0]));\n      continue;\n    }\n\n    if (src) {\n      throw new\n        Error('Infinite loop on byte: ' + src.charCodeAt(0));\n    }\n  }\n\n  return out;\n};\n\n/**\n * Compile Link\n */\n\nInlineLexer.prototype.outputLink = function(cap, link) {\n  if (cap[0].charAt(0) !== '!') {\n    return '<a href=\"'\n      + escape(link.href)\n      + '\"'\n      + (link.title\n      ? ' title=\"'\n      + escape(link.title)\n      + '\"'\n      : '')\n      + '>'\n      + this.output(cap[1])\n      + '</a>';\n  } else {\n    return '<img src=\"'\n      + escape(link.href)\n      + '\" alt=\"'\n      + escape(cap[1])\n      + '\"'\n      + (link.title\n      ? ' title=\"'\n      + escape(link.title)\n      + '\"'\n      : '')\n      + '>';\n  }\n};\n\n/**\n * Smartypants Transformations\n */\n\nInlineLexer.prototype.smartypants = function(text) {\n  if (!this.options.smartypants) return text;\n  return text\n    // em-dashes\n    .replace(/--/g, '\\u2014')\n    // opening singles\n    .replace(/(^|[-\\u2014/(\\[{\"\\s])'/g, '$1\\u2018')\n    // closing singles & apostrophes\n    .replace(/'/g, '\\u2019')\n    // opening doubles\n    .replace(/(^|[-\\u2014/(\\[{\\u2018\\s])\"/g, '$1\\u201c')\n    // closing doubles\n    .replace(/\"/g, '\\u201d')\n    // ellipses\n    .replace(/\\.{3}/g, '\\u2026');\n};\n\n/**\n * Mangle Links\n */\n\nInlineLexer.prototype.mangle = function(text) {\n  var out = ''\n    , l = text.length\n    , i = 0\n    , ch;\n\n  for (; i < l; i++) {\n    ch = text.charCodeAt(i);\n    if (Math.random() > 0.5) {\n      ch = 'x' + ch.toString(16);\n    }\n    out += '&#' + ch + ';';\n  }\n\n  return out;\n};\n\n/**\n * Parsing & Compiling\n */\n\nfunction Parser(options) {\n  this.tokens = [];\n  this.token = null;\n  this.options = options || marked.defaults;\n}\n\n/**\n * Static Parse Method\n */\n\nParser.parse = function(src, options) {\n  var parser = new Parser(options);\n  return parser.parse(src);\n};\n\n/**\n * Parse Loop\n */\n\nParser.prototype.parse = function(src) {\n  this.inline = new InlineLexer(src.links, this.options);\n  this.tokens = src.reverse();\n\n  var out = '';\n  while (this.next()) {\n    out += this.tok();\n  }\n\n  return out;\n};\n\n/**\n * Next Token\n */\n\nParser.prototype.next = function() {\n  return this.token = this.tokens.pop();\n};\n\n/**\n * Preview Next Token\n */\n\nParser.prototype.peek = function() {\n  return this.tokens[this.tokens.length - 1] || 0;\n};\n\n/**\n * Parse Text Tokens\n */\n\nParser.prototype.parseText = function() {\n  var body = this.token.text;\n\n  while (this.peek().type === 'text') {\n    body += '\\n' + this.next().text;\n  }\n\n  return this.inline.output(body);\n};\n\n/**\n * Parse Current Token\n */\n\nParser.prototype.tok = function() {\n  switch (this.token.type) {\n    case 'space': {\n      return '';\n    }\n    case 'hr': {\n      return '<hr>\\n';\n    }\n    case 'heading': {\n      return '<h'\n        + this.token.depth\n        + ' id=\"'\n        + this.token.text.toLowerCase().replace(/[^\\w]+/g, '-')\n        + '\">'\n        + this.inline.output(this.token.text)\n        + '</h'\n        + this.token.depth\n        + '>\\n';\n    }\n    case 'code': {\n      if (this.options.highlight) {\n        var code = this.options.highlight(this.token.text, this.token.lang);\n        if (code != null && code !== this.token.text) {\n          this.token.escaped = true;\n          this.token.text = code;\n        }\n      }\n\n      if (!this.token.escaped) {\n        this.token.text = escape(this.token.text, true);\n      }\n\n      return '<pre><code'\n        + (this.token.lang\n        ? ' class=\"'\n        + this.options.langPrefix\n        + this.token.lang\n        + '\"'\n        : '')\n        + '>'\n        + this.token.text\n        + '</code></pre>\\n';\n    }\n    case 'table': {\n      var body = ''\n        , heading\n        , i\n        , row\n        , cell\n        , j;\n\n      // header\n      body += '<thead>\\n<tr>\\n';\n      for (i = 0; i < this.token.header.length; i++) {\n        heading = this.inline.output(this.token.header[i]);\n        body += '<th';\n        if (this.token.align[i]) {\n          body += ' style=\"text-align:' + this.token.align[i] + '\"';\n        }\n        body += '>' + heading + '</th>\\n';\n      }\n      body += '</tr>\\n</thead>\\n';\n\n      // body\n      body += '<tbody>\\n'\n      for (i = 0; i < this.token.cells.length; i++) {\n        row = this.token.cells[i];\n        body += '<tr>\\n';\n        for (j = 0; j < row.length; j++) {\n          cell = this.inline.output(row[j]);\n          body += '<td';\n          if (this.token.align[j]) {\n            body += ' style=\"text-align:' + this.token.align[j] + '\"';\n          }\n          body += '>' + cell + '</td>\\n';\n        }\n        body += '</tr>\\n';\n      }\n      body += '</tbody>\\n';\n\n      return '<table>\\n'\n        + body\n        + '</table>\\n';\n    }\n    case 'blockquote_start': {\n      var body = '';\n\n      while (this.next().type !== 'blockquote_end') {\n        body += this.tok();\n      }\n\n      return '<blockquote>\\n'\n        + body\n        + '</blockquote>\\n';\n    }\n    case 'list_start': {\n      var type = this.token.ordered ? 'ol' : 'ul'\n        , body = '';\n\n      while (this.next().type !== 'list_end') {\n        body += this.tok();\n      }\n\n      return '<'\n        + type\n        + '>\\n'\n        + body\n        + '</'\n        + type\n        + '>\\n';\n    }\n    case 'list_item_start': {\n      var body = '';\n\n      while (this.next().type !== 'list_item_end') {\n        body += this.token.type === 'text'\n          ? this.parseText()\n          : this.tok();\n      }\n\n      return '<li>'\n        + body\n        + '</li>\\n';\n    }\n    case 'loose_item_start': {\n      var body = '';\n\n      while (this.next().type !== 'list_item_end') {\n        body += this.tok();\n      }\n\n      return '<li>'\n        + body\n        + '</li>\\n';\n    }\n    case 'html': {\n      return !this.token.pre && !this.options.pedantic\n        ? this.inline.output(this.token.text)\n        : this.token.text;\n    }\n    case 'paragraph': {\n      return '<p>'\n        + this.inline.output(this.token.text)\n        + '</p>\\n';\n    }\n    case 'text': {\n      return '<p>'\n        + this.parseText()\n        + '</p>\\n';\n    }\n  }\n};\n\n/**\n * Helpers\n */\n\nfunction escape(html, encode) {\n  return html\n    .replace(!encode ? /&(?!#?\\w+;)/g : /&/g, '&amp;')\n    .replace(/</g, '&lt;')\n    .replace(/>/g, '&gt;')\n    .replace(/\"/g, '&quot;')\n    .replace(/'/g, '&#39;');\n}\n\nfunction replace(regex, opt) {\n  regex = regex.source;\n  opt = opt || '';\n  return function self(name, val) {\n    if (!name) return new RegExp(regex, opt);\n    val = val.source || val;\n    val = val.replace(/(^|[^\\[])\\^/g, '$1');\n    regex = regex.replace(name, val);\n    return self;\n  };\n}\n\nfunction noop() {}\nnoop.exec = noop;\n\nfunction merge(obj) {\n  var i = 1\n    , target\n    , key;\n\n  for (; i < arguments.length; i++) {\n    target = arguments[i];\n    for (key in target) {\n      if (Object.prototype.hasOwnProperty.call(target, key)) {\n        obj[key] = target[key];\n      }\n    }\n  }\n\n  return obj;\n}\n\n/**\n * Marked\n */\n\nfunction marked(src, opt, callback) {\n  if (callback || typeof opt === 'function') {\n    if (!callback) {\n      callback = opt;\n      opt = null;\n    }\n\n    opt = merge({}, marked.defaults, opt || {});\n\n    var highlight = opt.highlight\n      , tokens\n      , pending\n      , i = 0;\n\n    try {\n      tokens = Lexer.lex(src, opt)\n    } catch (e) {\n      return callback(e);\n    }\n\n    pending = tokens.length;\n\n    var done = function() {\n      var out, err;\n\n      try {\n        out = Parser.parse(tokens, opt);\n      } catch (e) {\n        err = e;\n      }\n\n      opt.highlight = highlight;\n\n      return err\n        ? callback(err)\n        : callback(null, out);\n    };\n\n    if (!highlight || highlight.length < 3) {\n      return done();\n    }\n\n    delete opt.highlight;\n\n    if (!pending) return done();\n\n    for (; i < tokens.length; i++) {\n      (function(token) {\n        if (token.type !== 'code') {\n          return --pending || done();\n        }\n        return highlight(token.text, token.lang, function(err, code) {\n          if (code == null || code === token.text) {\n            return --pending || done();\n          }\n          token.text = code;\n          token.escaped = true;\n          --pending || done();\n        });\n      })(tokens[i]);\n    }\n\n    return;\n  }\n  try {\n    if (opt) opt = merge({}, marked.defaults, opt);\n    return Parser.parse(Lexer.lex(src, opt), opt);\n  } catch (e) {\n    e.message += '\\nPlease report this to https://github.com/chjj/marked.';\n    if ((opt || marked.defaults).silent) {\n      return '<p>An error occured:</p><pre>'\n        + escape(e.message + '', true)\n        + '</pre>';\n    }\n    throw e;\n  }\n}\n\n/**\n * Options\n */\n\nmarked.options =\nmarked.setOptions = function(opt) {\n  merge(marked.defaults, opt);\n  return marked;\n};\n\nmarked.defaults = {\n  gfm: true,\n  tables: true,\n  breaks: false,\n  pedantic: false,\n  sanitize: false,\n  smartLists: false,\n  silent: false,\n  highlight: null,\n  langPrefix: 'lang-',\n  smartypants: false\n};\n\n/**\n * Expose\n */\n\nmarked.Parser = Parser;\nmarked.parser = Parser.parse;\n\nmarked.Lexer = Lexer;\nmarked.lexer = Lexer.lex;\n\nmarked.InlineLexer = InlineLexer;\nmarked.inlineLexer = InlineLexer.output;\n\nmarked.parse = marked;\n\nif (typeof exports === 'object') {\n  module.exports = marked;\n} else if (typeof define === 'function' && define.amd) {\n  define(function() { return marked; });\n} else {\n  this.marked = marked;\n}\n\n}).call(function() {\n  return this || (typeof window !== 'undefined' ? window : global);\n}());\n",
          "type": "blob"
        },
        "main": {
          "path": "main",
          "content": "(function() {\n  var dependencyScripts, doctor, highlight, interactiveLoader, languages, makeScript, marked, packageScript, relativeScriptPath, unique;\n\n  marked = require(\"./lib/marked\");\n\n  highlight = require(\"./lib/highlight\");\n\n  languages = require(\"./languages\");\n\n  marked.setOptions({\n    highlight: function(code, lang) {\n      if (highlight.LANGUAGES[lang]) {\n        return highlight.highlight(lang, code).value;\n      } else {\n        console.warn(\"couldn't highlight code block with unknown language '\" + lang + \"'\");\n        return code;\n      }\n    }\n  });\n\n  module.exports = doctor = {\n    parse: require('./parse'),\n    template: require('./template'),\n    compile: function(content, language) {\n      if (language == null) {\n        language = \"coffeescript\";\n      }\n      return doctor.parse(content).map(function(_arg) {\n        var code, text;\n        text = _arg.text, code = _arg.code;\n        return {\n          docsHtml: marked(text),\n          codeHtml: marked(\"```\" + language + \"\\n\" + code + \"\\n```\")\n        };\n      });\n    },\n    documentAll: function(pkg) {\n      var base, branch, default_branch, documentableFiles, entryPoint, extras, repository, results, scripts, source;\n      entryPoint = pkg.entryPoint, source = pkg.source, repository = pkg.repository;\n      branch = repository.branch, default_branch = repository.default_branch;\n      if (branch === \"blog\") {\n        base = \"\";\n      } else if (branch === default_branch) {\n        base = \"docs/\";\n      } else {\n        base = \"\" + branch + \"/docs/\";\n      }\n      documentableFiles = Object.keys(source).select(function(name) {\n        return name.extension() === \"md\";\n      });\n      results = documentableFiles.map(function(name) {\n        var language;\n        language = name.withoutExtension().extension();\n        language = languages[language] || language;\n        return doctor.compile(source[name].content, language);\n      });\n      extras = [packageScript(base, pkg)];\n      scripts = dependencyScripts(unique([\"https://code.jquery.com/jquery-1.10.1.min.js\", \"https://cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js\", \"http://www.danielx.net/require/v0.2.2.js\"].concat(pkg.remoteDependencies || [])));\n      scripts += interactiveLoader;\n      results = results.map(function(result, i) {\n        var content, name;\n        name = documentableFiles[i].withoutExtension().withoutExtension();\n        content = doctor.template({\n          title: name,\n          sections: result,\n          scripts: \"\" + scripts + (makeScript(relativeScriptPath(name)))\n        });\n        if (name === entryPoint) {\n          extras.push({\n            content: content,\n            mode: \"100644\",\n            path: \"\" + base + \"index.html\",\n            type: \"blob\"\n          });\n        }\n        return {\n          content: content,\n          mode: \"100644\",\n          path: \"\" + base + name + \".html\",\n          type: \"blob\"\n        };\n      });\n      return Deferred().resolve(extras.concat(results));\n    }\n  };\n\n  interactiveLoader = \"<script>\\n  $.ajax({\\n    url: \\\"http://strd6.github.io/interactive/v0.8.1.jsonp\\\",\\n    dataType: \\\"jsonp\\\",\\n    jsonpCallback: \\\"STRd6/interactive:v0.8.1\\\",\\n    cache: true\\n  }).then(function(PACKAGE) {\\n    Require.generateFor(PACKAGE)(\\\"./\\\" + PACKAGE.entryPoint)\\n  })\\n<\\/script>\";\n\n  makeScript = function(src) {\n    var script;\n    script = document.createElement(\"script\");\n    script.src = src;\n    return script.outerHTML;\n  };\n\n  dependencyScripts = function(remoteDependencies) {\n    if (remoteDependencies == null) {\n      remoteDependencies = [];\n    }\n    return remoteDependencies.map(makeScript).join(\"\\n\");\n  };\n\n  unique = function(array) {\n    return array.reduce(function(results, item) {\n      if (results.indexOf(item) === -1) {\n        results.push(item);\n      }\n      return results;\n    }, []);\n  };\n\n  packageScript = function(base, pkg) {\n    return {\n      content: \"(function(pkg) {\\n  // Expose a require for our package so scripts can access our modules\\n  window.require = Require.generateFor(pkg);\\n})(\" + (JSON.stringify(pkg, null, 2)) + \");\",\n      mode: \"100644\",\n      path: \"\" + base + \"package.js\",\n      type: \"blob\"\n    };\n  };\n\n  relativeScriptPath = function(path) {\n    var results, upOne;\n    upOne = \"../\";\n    results = [];\n    (path.split(\"/\").length - 1).times(function() {\n      return results.push(upOne);\n    });\n    return results.concat(\"package.js\").join(\"\");\n  };\n\n}).call(this);\n\n//# sourceURL=main.coffee",
          "type": "blob"
        },
        "parse": {
          "path": "parse",
          "content": "(function() {\n  var blank, indent, parse, sectionBreak, truncateEmpties;\n\n  indent = /^([ ]{4}|\\t)/;\n\n  blank = /^\\s*$/;\n\n  sectionBreak = /^(---+|===+)$/;\n\n  parse = function(source) {\n    var Section, lastSection, lastWasCode, pushCode, pushEmpty, pushText, sections;\n    Section = function() {\n      return {\n        text: [],\n        code: []\n      };\n    };\n    sections = [Section()];\n    lastSection = function() {\n      return sections.last();\n    };\n    pushCode = function(code) {\n      return lastSection().code.push(code);\n    };\n    pushText = function(text) {\n      var section;\n      if (lastSection().code.length) {\n        section = Section();\n        section.text.push(text);\n        return sections.push(section);\n      } else {\n        lastSection().text.push(text);\n        if (sectionBreak.test(text)) {\n          return sections.push(Section());\n        }\n      }\n    };\n    pushEmpty = function() {\n      if (lastWasCode) {\n        return pushCode(\"\");\n      } else {\n        return lastSection().text.push(\"\");\n      }\n    };\n    lastWasCode = false;\n    source.split(\"\\n\").each(function(line) {\n      var match;\n      if (blank.exec(line)) {\n        return pushEmpty();\n      } else if (match = indent.exec(line)) {\n        lastWasCode = true;\n        return pushCode(line.slice(match[0].length));\n      } else {\n        lastWasCode = false;\n        return pushText(line);\n      }\n    });\n    return sections.each(function(section) {\n      section.text = truncateEmpties(section.text).join(\"\\n\");\n      return section.code = truncateEmpties(section.code).join(\"\\n\");\n    });\n  };\n\n  module.exports = parse;\n\n  truncateEmpties = function(array) {\n    var last;\n    while (((last = array.last()) != null) && last === \"\") {\n      array.pop();\n    }\n    return array;\n  };\n\n}).call(this);\n\n//# sourceURL=parse.coffee",
          "type": "blob"
        },
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"version\":\"0.3.2\",\"remoteDependencies\":[\"https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.5.2/underscore-min.js\",\"http://www.danielx.net/tempest/javascripts/envweb.js\"]};",
          "type": "blob"
        },
        "template": {
          "path": "template",
          "content": "(function() {\n  var template;\n\n  template = _.template(\"<!DOCTYPE html>\\n\\n<html>\\n<head>\\n  <title><%= title %></title>\\n  <meta http-equiv=\\\"content-type\\\" content=\\\"text/html; charset=UTF-8\\\">\\n  <meta name=\\\"viewport\\\" content=\\\"width=device-width, target-densitydpi=160dpi, initial-scale=1.0; maximum-scale=1.0; user-scalable=0;\\\">\\n  <link rel=\\\"stylesheet\\\" media=\\\"all\\\" href=\\\"http://strd6.github.io/cdn/parallel/docco.css\\\" />\\n</head>\\n<body>\\n  <div id=\\\"container\\\">\\n    <div id=\\\"background\\\"></div>\\n    <ul class=\\\"sections\\\">\\n        <% for (var i=0, l=sections.length; i<l; i++) { %>\\n        <% var section = sections[i]; %>\\n        <li id=\\\"section-<%= i + 1 %>\\\">\\n            <div class=\\\"annotation\\\">\\n              <div class=\\\"pilwrap\\\">\\n                <a class=\\\"pilcrow\\\" href=\\\"#section-<%= i + 1 %>\\\">&#182;</a>\\n              </div>\\n              <%= section.docsHtml %>\\n            </div>\\n            <div class=\\\"content\\\"><%= section.codeHtml %></div>\\n        </li>\\n        <% } %>\\n    </ul>\\n  </div>\\n  <%= scripts %>\\n</body>\\n</html>\");\n\n  module.exports = template;\n\n}).call(this);\n\n//# sourceURL=template.coffee",
          "type": "blob"
        },
        "test/languages": {
          "path": "test/languages",
          "content": "(function() {\n  var languages;\n\n  languages = require(\"../languages\");\n\n  describe(\"languages\", function() {\n    return it(\"should know of coffeescript and javascript\", function() {\n      assert(languages.js === \"javascript\");\n      return assert(languages.coffee === \"coffeescript\");\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/languages.coffee",
          "type": "blob"
        },
        "test/main": {
          "path": "test/main",
          "content": "(function() {\n  var highlight, marked, md;\n\n  md = require(\"../main\");\n\n  marked = require(\"../lib/marked\");\n\n  highlight = require(\"../lib/highlight\");\n\n  describe(\"marked markdown generation\", function() {\n    return it(\"should compile markdown\", function() {\n      return assert(marked('I am using __markdown__.'));\n    });\n  });\n\n  describe(\"hightlight.js\", function() {\n    return it(\"highlight stuff\", function() {\n      return assert(highlight);\n    });\n  });\n\n  describe(\"Parsing\", function() {\n    return it(\"should return an array of sections\", function() {\n      var sections;\n      sections = md.parse(\"A sample text + code section\\n\\n    I'm the code\");\n      assert(sections.length === 1);\n      assert(sections.first().text === \"A sample text + code section\");\n      return assert(sections.first().code === \"I'm the code\");\n    });\n  });\n\n  describe(\"Stuff spanning multiple lines\", function() {\n    return it(\"should be split by newline characters\", function() {\n      var sections;\n      sections = md.parse(\"1\\n2\\n3\\n\\n    Code1\\n    Code2\");\n      assert(sections.length === 1);\n      assert(sections.first().text === \"1\\n2\\n3\");\n      return assert(sections.first().code === \"Code1\\nCode2\");\n    });\n  });\n\n  describe(\"A normal markdown paragraph\", function() {\n    return it(\"should keep newlines within\", function() {\n      var sections;\n      sections = md.parse(\"I'm talking about stuff.\\n\\nParagraph two is rad!\");\n      return assert(sections.first().text.match(\"\\n\\n\"));\n    });\n  });\n\n  describe(\"Headers\", function() {\n    return it(\"should split sections\", function() {\n      var sections;\n      sections = md.parse(\"Intro\\n-----\\n\\nSome other stuff\");\n      return assert(sections.length === 2);\n    });\n  });\n\n  describe(\"Many code text sequences\", function() {\n    return it(\"should add text in new sections after code\", function() {\n      var sections;\n      sections = md.parse(\"Some description\\n\\n    Code\\n\\nAnother description\\n\\n    More code\\n\\nHey\");\n      return assert(sections.length === 3);\n    });\n  });\n\n  describe(\"documenting a file\", function() {\n    return it(\"should be 2legit\", function() {\n      return assert(md.compile(\"Hey\"));\n    });\n  });\n\n  describe(\"documenting a file package\", function() {\n    return it(\"should be 2legit\", function(done) {\n      return md.documentAll({\n        repository: {\n          branch: \"master\",\n          default_branch: \"master\"\n        },\n        entryPoint: \"main\",\n        source: {\n          \"main.coffee.md\": {\n            content: \"Yolo is a lifestyle choice\\n    alert 'wat'\"\n          }\n        }\n      }).then(function(results) {\n        return done();\n      });\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/main.coffee",
          "type": "blob"
        },
        "test/template": {
          "path": "test/template",
          "content": "(function() {\n  var template;\n\n  template = require(\"../template\");\n\n  describe(\"template\", function() {\n    it(\"should exist\", function() {\n      return assert(template);\n    });\n    return it(\"should render html when given a title and sections\", function() {\n      var result;\n      result = template({\n        scripts: \"\",\n        title: \"Test\",\n        sections: [\n          {\n            docsHtml: \"<h1>Hello</h1>\",\n            codeHtml: \"<pre>1 + 1 == 2</pre>\"\n          }\n        ]\n      });\n      return assert(result);\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/template.coffee",
          "type": "blob"
        }
      },
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "version": "0.3.2",
      "entryPoint": "main",
      "remoteDependencies": [
        "https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.5.2/underscore-min.js",
        "http://www.danielx.net/tempest/javascripts/envweb.js"
      ],
      "repository": {
        "id": 13102476,
        "name": "md",
        "full_name": "STRd6/md",
        "owner": {
          "login": "STRd6",
          "id": 18894,
          "avatar_url": "https://gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
          "gravatar_id": "33117162fff8a9cf50544a604f60c045",
          "url": "https://api.github.com/users/STRd6",
          "html_url": "https://github.com/STRd6",
          "followers_url": "https://api.github.com/users/STRd6/followers",
          "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
          "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
          "organizations_url": "https://api.github.com/users/STRd6/orgs",
          "repos_url": "https://api.github.com/users/STRd6/repos",
          "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
          "received_events_url": "https://api.github.com/users/STRd6/received_events",
          "type": "User",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/STRd6/md",
        "description": "Generate documentation from from literate code files.",
        "fork": false,
        "url": "https://api.github.com/repos/STRd6/md",
        "forks_url": "https://api.github.com/repos/STRd6/md/forks",
        "keys_url": "https://api.github.com/repos/STRd6/md/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/STRd6/md/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/STRd6/md/teams",
        "hooks_url": "https://api.github.com/repos/STRd6/md/hooks",
        "issue_events_url": "https://api.github.com/repos/STRd6/md/issues/events{/number}",
        "events_url": "https://api.github.com/repos/STRd6/md/events",
        "assignees_url": "https://api.github.com/repos/STRd6/md/assignees{/user}",
        "branches_url": "https://api.github.com/repos/STRd6/md/branches{/branch}",
        "tags_url": "https://api.github.com/repos/STRd6/md/tags",
        "blobs_url": "https://api.github.com/repos/STRd6/md/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/STRd6/md/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/STRd6/md/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/STRd6/md/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/STRd6/md/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/STRd6/md/languages",
        "stargazers_url": "https://api.github.com/repos/STRd6/md/stargazers",
        "contributors_url": "https://api.github.com/repos/STRd6/md/contributors",
        "subscribers_url": "https://api.github.com/repos/STRd6/md/subscribers",
        "subscription_url": "https://api.github.com/repos/STRd6/md/subscription",
        "commits_url": "https://api.github.com/repos/STRd6/md/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/STRd6/md/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/STRd6/md/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/STRd6/md/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/STRd6/md/contents/{+path}",
        "compare_url": "https://api.github.com/repos/STRd6/md/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/STRd6/md/merges",
        "archive_url": "https://api.github.com/repos/STRd6/md/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/STRd6/md/downloads",
        "issues_url": "https://api.github.com/repos/STRd6/md/issues{/number}",
        "pulls_url": "https://api.github.com/repos/STRd6/md/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/STRd6/md/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/STRd6/md/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/STRd6/md/labels{/name}",
        "releases_url": "https://api.github.com/repos/STRd6/md/releases{/id}",
        "created_at": "2013-09-25T18:55:25Z",
        "updated_at": "2013-12-03T22:05:02Z",
        "pushed_at": "2013-12-03T22:04:58Z",
        "git_url": "git://github.com/STRd6/md.git",
        "ssh_url": "git@github.com:STRd6/md.git",
        "clone_url": "https://github.com/STRd6/md.git",
        "svn_url": "https://github.com/STRd6/md",
        "homepage": null,
        "size": 880,
        "stargazers_count": 0,
        "watchers_count": 0,
        "language": "JavaScript",
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "default_branch": "master",
        "master_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "network_count": 0,
        "subscribers_count": 1,
        "branch": "v0.3.2",
        "defaultBranch": "master"
      },
      "dependencies": {},
      "name": "md"
    },
    "github": {
      "source": {
        "LICENSE": {
          "path": "LICENSE",
          "mode": "100644",
          "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
          "type": "blob"
        },
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "github\n======\n\nGithub API for online IDEs\n",
          "type": "blob"
        },
        "api_generator.coffee.md": {
          "path": "api_generator.coffee.md",
          "mode": "100644",
          "content": "\nGenerate all those fun API verbs: `get`, `put`, `post`, `patch`, `delete`\n\nOur helpers need a root to base off of. The root is a function that returns a\nstring. The requester does the actual api calls, these just set it up easily.\n\n    ApiGenerator = (root, requester) ->\n\nConfigure the options for a request by stringifying any data to be added to the\nrequest body, and setting the appropriate type. `get` requests don't call this\nas the default type is `get` and they put their params in the querystring.\n\n      requestOptions = (type, data) ->\n        type: type\n        data: JSON.stringify(data)\n\nIf our request is absolute we use that url, otherwise we get the base url from\nour root and append the path. This allows us to follow HATEOS resource urls more\neasily.\n\n      api = (path, options) ->\n        if path.match /^http/\n          url = path\n        else\n          url = \"#{root()}/#{path}\"\n\n        requester url, options\n\nExpose the basic api method in our returned object.\n\n      api: api\n\n      get: (path, data) ->\n        api path, data: data\n\n      put: (path, data) ->\n        api(path, requestOptions(\"PUT\", data))\n\n      post: (path, data) ->\n        api(path, requestOptions(\"POST\", data))\n\n      patch: (path, data) ->\n        api path, requestOptions(\"PATCH\", data)\n\n`delete` is a keyword in JS, so I guess we'll go with all caps. We maybe should\ngo with all caps for everything, but it seems so loud.\n\n      DELETE: (path, data) ->\n        api path, requestOptions(\"DELETE\", data)\n\n    module.exports = ApiGenerator\n",
          "type": "blob"
        },
        "main.coffee.md": {
          "path": "main.coffee.md",
          "mode": "100644",
          "content": "    Repository = require \"./repository\"\n\nGithub handles our connections to the Github API. May be optionally passed a\npromise that when fulfilled will set the authorization token.\n\n    Github = (tokenPromise) ->\n\nOur OAuth token for making API requests. We can still make anonymous requests\nwithout it.\n\n      token = null\n\n      tokenPromise?.then (tokenValue) ->\n        token = tokenValue\n\nHold an observable for the last request so we can track things like oauth scopes\nand rate limit.\n\n      lastRequest = Observable()\n\nMake a call to the github API. The path can be either a relative path such as\n`users/STRd6` or an absolute path like `https://api.github.com/users/octocat` or\n`user.url`.\n\nWe attach our `accessToken` if present.\n\n`api` returns a promise for easy chaining.\n\n      api = (path, options={}) ->\n        if path.match /^http/\n          url = path\n        else\n          url = \"https://api.github.com/#{path}\"\n\n        options.headers ||= {}\n\n        if token\n          options.headers[\"Authorization\"] = \"token #{token}\"\n\n        options = Object.extend\n          url: url\n          type: \"GET\"\n          dataType: 'json'\n          contentType: \"application/json; charset=utf-8\"\n        , options\n\nPerform the ajax call and observe requests on success or failure\n\n        $.ajax(options).done (data, status, request) ->\n          lastRequest(request)\n        .fail lastRequest\n\nPublicly expose `api` method.\n\n      api: api\n\n`markdown` takes a string of source and returns a promise that will complete with\nthe rendered markdown by posting it to Github.\n\nSee also: http://developer.github.com/v3/markdown/\n\n      markdown: require('./markdown')(api)\n\nAlso expose `lastRequest`.\n\n      lastRequest: lastRequest\n\nGetter/Setter for auth token.\n\n      token: (newValue) ->\n        if arguments.length > 0\n          token = newValue\n        else\n          token\n\nExpose the `Repository` constructor so that others can create repositories from\nraw data.\n\n      Repository: (data={}) ->\n        # Use our api for the repository\n        Object.defaults data,\n          requester: api\n\n        Repository(data)\n\nGet a repository, returns a promise that will have a repository one day.\n\n      repository: (fullName) ->\n        # TODO: Consider returning a repository proxy immediately\n        #   may need to be weighed carefully with the tradeoffs of observables.\n        # TODO: Consider creating from a full url in addition to a full name.\n\n        api(\"repos/#{fullName}\")\n        .then (data) ->\n          Object.defaults data,\n            requester: api\n\n          Repository(data)\n\nExpose `authorizationUrl` to instances as well.\n\n      authorizationUrl: Github.authorizationUrl\n\nA URL that will authorize a user with the specified scope for the given app.\n\n    Github.authorizationUrl = (clientId, scope=\"user:email\") ->\n      \"https://github.com/login/oauth/authorize?client_id=#{clientId}&scope=#{scope}\"\n\n    module.exports = Github\n",
          "type": "blob"
        },
        "markdown.coffee.md": {
          "path": "markdown.coffee.md",
          "mode": "100644",
          "content": "Markdown\n========\n\nExpose Github's Markdown API.\n\n    module.exports = (api) ->\n      (source) ->\n        api \"markdown\",\n          type: \"POST\"\n          dataType: \"text\"\n          data: JSON.stringify\n            text: source\n            mode: \"markdown\"\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "version: \"0.4.2\"\nremoteDependencies: [\n  \"https://code.jquery.com/jquery-1.10.1.min.js\"\n  \"http://strd6.github.io/tempest/javascripts/envweb-v0.4.5.js\"\n]\ndependencies:\n  emojer: \"STRd6/emojer:v0.2.0\"\n",
          "type": "blob"
        },
        "repository.coffee.md": {
          "path": "repository.coffee.md",
          "mode": "100644",
          "content": "Repsoitory\n==========\n\n`Repository` wraps the concept of a Github repository. It includes additional\ndata for the local working copy such as the current branch.\n\nAll of the methods return promises to allow for easy chaining and error\nreporting.\n\n    ApiGenerator = require('./api_generator')\n\nAn emoji generator to make commits pop!\n\n    emojer = require \"emojer\"\n\n    emojis = ->\n      \"#{emojer()}#{emojer()}\"\n\nConstructor\n-----------\n\nCurrently the only parameter needed to initialize a repository instance is a\n`url`. This url is used as a base for the api calls.\n\n    Repository = (I={}) ->\n      Object.defaults I,\n        branch: null\n        default_branch: \"master\"\n\n      # Requester only matters runtime, not real data\n      # TODO: This is kind of a hack\n      requester = I.requester\n      delete I.requester\n\n      self = Model(I).observeAll()\n\n      # TODO: Think about converting underscored properties to camel case in an\n      # automatic and consistent way.\n\n      self.defaultBranch = ->\n        I.default_branch\n\n      # Initialize chosen branch to default branch\n      unless self.branch()\n        self.branch(self.defaultBranch())\n\nGet api helper methods from the api generator. With them we can do things like\n`get \"branches\"` to list branches of this repo.\n\n      {get, put, post, patch} = ApiGenerator self.url, requester\n\n      self.extend\n        infoDisplay: ->\n          \"#{I.fullName} (#{self.branch()})\"\n\n        pullRequests: ->\n          get \"pulls\"\n\n        createPullRequest: ({title}) ->\n          head = title.dasherize()\n\n          self.switchToBranch(head)\n          .then(self.commitEmpty)\n          .then ->\n            post \"pulls\",\n              base: self.defaultBranch()\n              head: head\n              title: title\n\n        latestCommit: (branch=self.branch()) ->\n          get(\"git/refs/heads/#{branch}#{cacheBuster()}\")\n          .then (data) ->\n            get data.object.url\n\n        latestContent: (branch=self.branch()) ->\n          self.latestCommit(branch)\n          .then (data) ->\n            get \"#{data.tree.url}?recursive=1\"\n          .then (data) ->\n            files = data.tree.select (file) ->\n              file.type is \"blob\"\n\n            # Gather the data for each file\n            $.when.apply(null, files.map (datum) ->\n              get(datum.url)\n              .then (data) ->\n                Object.extend(datum, data)\n            )\n          .then (results...) ->\n            results\n\n        commitTree: ({branch, message, baseTree, tree, empty}) ->\n          branch ?= self.branch()\n          message ?= \"#{emojis()} Updated in browser at strd6.github.io/editor\"\n\n          # TODO: Is there a cleaner way to pass this through promises?\n          latestCommitSha = null\n\n          self.latestCommit(branch)\n          .then (data) ->\n            latestCommitSha = data.sha\n\n            if baseTree is true\n              baseTree = data.tree.sha\n\n            if empty is true\n              Deferred().resolve(data.tree)\n            else\n              # TODO: Github barfs when committing blank files\n              tree = tree.filter (file) ->\n                if file.content\n                  true\n                else\n                  console.warn \"Blank content for: \", file\n                  false\n\n              post \"git/trees\",\n                base_tree: baseTree\n                tree: tree\n          .then (data) ->\n            # Create another commit\n            post \"git/commits\",\n              parents: [latestCommitSha]\n              message: message\n              tree: data.sha\n          .then (data) ->\n            # Update the branch head\n            patch \"git/refs/heads/#{branch}\",\n              sha: data.sha\n\n        # TODO: this is currently a hack because we can't create a pull request\n        # if there are no different commits\n        commitEmpty: ->\n          self.commitTree\n            empty: true\n            message: \"This commit intentionally left blank\"\n\nCreates ref (if it doesn't already exist) using our current branch as a base.\n\n        createRef: (ref) ->\n          get(\"git/refs/heads/#{self.branch()}\")\n          .then (data) ->\n            post \"git/refs\",\n              ref: ref\n              sha: data.object.sha\n\n        switchToBranch: (branch) ->\n          ref = \"refs/heads/#{branch}\"\n\n          setBranch = (data) ->\n            self.branch(branch)\n\n            return data\n\n          get(\"git/#{ref}\")\n          .then setBranch # Success\n          , (request) -> # Failure\n            branchNotFound = (request.status is 404)\n\n            if branchNotFound\n              self.createRef(ref)\n              .then(setBranch)\n            else\n              Deferred().reject(arguments...)\n\n        mergeInto: (branch=self.defaultBranch()) ->\n          post \"merges\",\n            base: branch\n            head: self.branch()\n\n        pullFromBranch: (branch=self.defaultBranch()) ->\n          post \"merges\",\n            base: self.branch()\n            head: branch\n\nThe default branch that we publish our packaged content to.\n\n        publishBranch: ->\n          \"gh-pages\"\n\nInitialize the publish branch, usually `gh-pages`. We create an empty\ntree and set it as a root commit (one with no parents). Then we create\nthe branch referencing that commit.\n\n        initPublishBranch: (branch=self.publishBranch()) ->\n          # Post an empty tree to use for the base commit\n          # TODO: Learn how to post an actually empty tree\n          post \"git/trees\",\n            tree: [{\n              content: \"created by strd6.github.io/editor\"\n              mode: \"100644\"\n              path: \"tempest.txt\"\n              type: \"blob\"\n            }]\n          .then (data) ->\n            post \"git/commits\",\n              message: \"Initial commit #{emojis()}\"\n              tree: data.sha\n          .then (data) ->\n            # Create the branch from the base commit\n            post \"git/refs\",\n              ref: \"refs/heads/#{branch}\"\n              sha: data.sha\n\nEnsure our publish branch exists. If it is found it returns a promise that\nsucceeds right away, otherwise it attempts to create it. Either way it\nreturns a promise that will be fullfilled if the publish branch is legit.\n\n        ensurePublishBranch: (publishBranch=self.publishBranch()) ->\n          get(\"branches/#{publishBranch}\")\n          .then null, (request) ->\n            if request.status is 404\n              self.initPublishBranch(publishBranch)\n\nPublish our package for distribution by taking a tree and adding it to the\n`gh-pages` branch after making sure that branch exists.\n\n        publish: (tree, ref=self.branch(), publishBranch=self.publishBranch()) ->\n          message = \"#{emojis()} Built #{ref} in browser in strd6.github.io/editor\"\n\n          self.ensurePublishBranch(publishBranch).then ->\n            self.commitTree\n              baseTree: true\n              tree: tree\n              branch: publishBranch\n\nExpose our API methods.\n\n      Object.extend self,\n        get: get\n        put: put\n        post: post\n        patch: patch\n\n      return self\n\n    module.exports = Repository\n\nHelpers\n-------\n\n    cacheBuster = ->\n      \"?#{+ new Date}\"\n",
          "type": "blob"
        },
        "test/github.coffee.md": {
          "path": "test/github.coffee.md",
          "mode": "100644",
          "content": "Testing our Github API wrapper. Currently super hacky, but time heals all.\n\n    window.Github = require \"../main\"\n\n    describe \"Github\", ->\n      it \"Should be able to construct repositories\", ->\n        assert Github().repository\n\n        assert Github().Repository\n\n      it \"should have authorizationUrl as an instance method\", ->\n        assert Github().authorizationUrl\n\n      describe \"Repository\", ->\n\nHacky way to test requests. We just see if it returns a URL that looks ok.\n\n        expected = null\n        expectUrlToMatch = (regex) ->\n          expected = regex\n\n        testRequester = (url, data) ->\n          match = url.match(expected)\n          assert.equal !!match, true, \"\"\"\n            #{url} did not match #{expected}, #{match}\n          \"\"\"\n\n          then: ->\n\n        repository = Github().Repository\n          url: \"STRd6/testin\"\n          requester: testRequester\n\n        it \"should cache bust the latest commit\", ->\n          expectUrlToMatch /.*\\?\\d+/\n\n          repository.latestCommit()\n\n        it \"should create a merge when asked\", ->\n          expectUrlToMatch /STRd6\\/testin\\/merges/\n\n          repository.mergeInto()\n",
          "type": "blob"
        }
      },
      "distribution": {
        "api_generator": {
          "path": "api_generator",
          "content": "(function() {\n  var ApiGenerator;\n\n  ApiGenerator = function(root, requester) {\n    var api, requestOptions;\n    requestOptions = function(type, data) {\n      return {\n        type: type,\n        data: JSON.stringify(data)\n      };\n    };\n    api = function(path, options) {\n      var url;\n      if (path.match(/^http/)) {\n        url = path;\n      } else {\n        url = \"\" + (root()) + \"/\" + path;\n      }\n      return requester(url, options);\n    };\n    return {\n      api: api,\n      get: function(path, data) {\n        return api(path, {\n          data: data\n        });\n      },\n      put: function(path, data) {\n        return api(path, requestOptions(\"PUT\", data));\n      },\n      post: function(path, data) {\n        return api(path, requestOptions(\"POST\", data));\n      },\n      patch: function(path, data) {\n        return api(path, requestOptions(\"PATCH\", data));\n      },\n      DELETE: function(path, data) {\n        return api(path, requestOptions(\"DELETE\", data));\n      }\n    };\n  };\n\n  module.exports = ApiGenerator;\n\n}).call(this);\n\n//# sourceURL=api_generator.coffee",
          "type": "blob"
        },
        "main": {
          "path": "main",
          "content": "(function() {\n  var Github, Repository;\n\n  Repository = require(\"./repository\");\n\n  Github = function(tokenPromise) {\n    var api, lastRequest, token;\n    token = null;\n    if (tokenPromise != null) {\n      tokenPromise.then(function(tokenValue) {\n        return token = tokenValue;\n      });\n    }\n    lastRequest = Observable();\n    api = function(path, options) {\n      var url;\n      if (options == null) {\n        options = {};\n      }\n      if (path.match(/^http/)) {\n        url = path;\n      } else {\n        url = \"https://api.github.com/\" + path;\n      }\n      options.headers || (options.headers = {});\n      if (token) {\n        options.headers[\"Authorization\"] = \"token \" + token;\n      }\n      options = Object.extend({\n        url: url,\n        type: \"GET\",\n        dataType: 'json',\n        contentType: \"application/json; charset=utf-8\"\n      }, options);\n      return $.ajax(options).done(function(data, status, request) {\n        return lastRequest(request);\n      }).fail(lastRequest);\n    };\n    return {\n      api: api,\n      markdown: require('./markdown')(api),\n      lastRequest: lastRequest,\n      token: function(newValue) {\n        if (arguments.length > 0) {\n          return token = newValue;\n        } else {\n          return token;\n        }\n      },\n      Repository: function(data) {\n        if (data == null) {\n          data = {};\n        }\n        Object.defaults(data, {\n          requester: api\n        });\n        return Repository(data);\n      },\n      repository: function(fullName) {\n        return api(\"repos/\" + fullName).then(function(data) {\n          Object.defaults(data, {\n            requester: api\n          });\n          return Repository(data);\n        });\n      },\n      authorizationUrl: Github.authorizationUrl\n    };\n  };\n\n  Github.authorizationUrl = function(clientId, scope) {\n    if (scope == null) {\n      scope = \"user:email\";\n    }\n    return \"https://github.com/login/oauth/authorize?client_id=\" + clientId + \"&scope=\" + scope;\n  };\n\n  module.exports = Github;\n\n}).call(this);\n\n//# sourceURL=main.coffee",
          "type": "blob"
        },
        "markdown": {
          "path": "markdown",
          "content": "(function() {\n  module.exports = function(api) {\n    return function(source) {\n      return api(\"markdown\", {\n        type: \"POST\",\n        dataType: \"text\",\n        data: JSON.stringify({\n          text: source,\n          mode: \"markdown\"\n        })\n      });\n    };\n  };\n\n}).call(this);\n\n//# sourceURL=markdown.coffee",
          "type": "blob"
        },
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"version\":\"0.4.2\",\"remoteDependencies\":[\"https://code.jquery.com/jquery-1.10.1.min.js\",\"http://strd6.github.io/tempest/javascripts/envweb-v0.4.5.js\"],\"dependencies\":{\"emojer\":\"STRd6/emojer:v0.2.0\"}};",
          "type": "blob"
        },
        "repository": {
          "path": "repository",
          "content": "(function() {\n  var ApiGenerator, Repository, cacheBuster, emojer, emojis,\n    __slice = [].slice;\n\n  ApiGenerator = require('./api_generator');\n\n  emojer = require(\"emojer\");\n\n  emojis = function() {\n    return \"\" + (emojer()) + (emojer());\n  };\n\n  Repository = function(I) {\n    var get, patch, post, put, requester, self, _ref;\n    if (I == null) {\n      I = {};\n    }\n    Object.defaults(I, {\n      branch: null,\n      default_branch: \"master\"\n    });\n    requester = I.requester;\n    delete I.requester;\n    self = Model(I).observeAll();\n    self.defaultBranch = function() {\n      return I.default_branch;\n    };\n    if (!self.branch()) {\n      self.branch(self.defaultBranch());\n    }\n    _ref = ApiGenerator(self.url, requester), get = _ref.get, put = _ref.put, post = _ref.post, patch = _ref.patch;\n    self.extend({\n      infoDisplay: function() {\n        return \"\" + I.fullName + \" (\" + (self.branch()) + \")\";\n      },\n      pullRequests: function() {\n        return get(\"pulls\");\n      },\n      createPullRequest: function(_arg) {\n        var head, title;\n        title = _arg.title;\n        head = title.dasherize();\n        return self.switchToBranch(head).then(self.commitEmpty).then(function() {\n          return post(\"pulls\", {\n            base: self.defaultBranch(),\n            head: head,\n            title: title\n          });\n        });\n      },\n      latestCommit: function(branch) {\n        if (branch == null) {\n          branch = self.branch();\n        }\n        return get(\"git/refs/heads/\" + branch + (cacheBuster())).then(function(data) {\n          return get(data.object.url);\n        });\n      },\n      latestContent: function(branch) {\n        if (branch == null) {\n          branch = self.branch();\n        }\n        return self.latestCommit(branch).then(function(data) {\n          return get(\"\" + data.tree.url + \"?recursive=1\");\n        }).then(function(data) {\n          var files;\n          files = data.tree.select(function(file) {\n            return file.type === \"blob\";\n          });\n          return $.when.apply(null, files.map(function(datum) {\n            return get(datum.url).then(function(data) {\n              return Object.extend(datum, data);\n            });\n          }));\n        }).then(function() {\n          var results;\n          results = 1 <= arguments.length ? __slice.call(arguments, 0) : [];\n          return results;\n        });\n      },\n      commitTree: function(_arg) {\n        var baseTree, branch, empty, latestCommitSha, message, tree;\n        branch = _arg.branch, message = _arg.message, baseTree = _arg.baseTree, tree = _arg.tree, empty = _arg.empty;\n        if (branch == null) {\n          branch = self.branch();\n        }\n        if (message == null) {\n          message = \"\" + (emojis()) + \" Updated in browser at strd6.github.io/editor\";\n        }\n        latestCommitSha = null;\n        return self.latestCommit(branch).then(function(data) {\n          latestCommitSha = data.sha;\n          if (baseTree === true) {\n            baseTree = data.tree.sha;\n          }\n          if (empty === true) {\n            return Deferred().resolve(data.tree);\n          } else {\n            tree = tree.filter(function(file) {\n              if (file.content) {\n                return true;\n              } else {\n                console.warn(\"Blank content for: \", file);\n                return false;\n              }\n            });\n            return post(\"git/trees\", {\n              base_tree: baseTree,\n              tree: tree\n            });\n          }\n        }).then(function(data) {\n          return post(\"git/commits\", {\n            parents: [latestCommitSha],\n            message: message,\n            tree: data.sha\n          });\n        }).then(function(data) {\n          return patch(\"git/refs/heads/\" + branch, {\n            sha: data.sha\n          });\n        });\n      },\n      commitEmpty: function() {\n        return self.commitTree({\n          empty: true,\n          message: \"This commit intentionally left blank\"\n        });\n      },\n      createRef: function(ref) {\n        return get(\"git/refs/heads/\" + (self.branch())).then(function(data) {\n          return post(\"git/refs\", {\n            ref: ref,\n            sha: data.object.sha\n          });\n        });\n      },\n      switchToBranch: function(branch) {\n        var ref, setBranch;\n        ref = \"refs/heads/\" + branch;\n        setBranch = function(data) {\n          self.branch(branch);\n          return data;\n        };\n        return get(\"git/\" + ref).then(setBranch, function(request) {\n          var branchNotFound, _ref1;\n          branchNotFound = request.status === 404;\n          if (branchNotFound) {\n            return self.createRef(ref).then(setBranch);\n          } else {\n            return (_ref1 = Deferred()).reject.apply(_ref1, arguments);\n          }\n        });\n      },\n      mergeInto: function(branch) {\n        if (branch == null) {\n          branch = self.defaultBranch();\n        }\n        return post(\"merges\", {\n          base: branch,\n          head: self.branch()\n        });\n      },\n      pullFromBranch: function(branch) {\n        if (branch == null) {\n          branch = self.defaultBranch();\n        }\n        return post(\"merges\", {\n          base: self.branch(),\n          head: branch\n        });\n      },\n      publishBranch: function() {\n        return \"gh-pages\";\n      },\n      initPublishBranch: function(branch) {\n        if (branch == null) {\n          branch = self.publishBranch();\n        }\n        return post(\"git/trees\", {\n          tree: [\n            {\n              content: \"created by strd6.github.io/editor\",\n              mode: \"100644\",\n              path: \"tempest.txt\",\n              type: \"blob\"\n            }\n          ]\n        }).then(function(data) {\n          return post(\"git/commits\", {\n            message: \"Initial commit \" + (emojis()),\n            tree: data.sha\n          });\n        }).then(function(data) {\n          return post(\"git/refs\", {\n            ref: \"refs/heads/\" + branch,\n            sha: data.sha\n          });\n        });\n      },\n      ensurePublishBranch: function(publishBranch) {\n        if (publishBranch == null) {\n          publishBranch = self.publishBranch();\n        }\n        return get(\"branches/\" + publishBranch).then(null, function(request) {\n          if (request.status === 404) {\n            return self.initPublishBranch(publishBranch);\n          }\n        });\n      },\n      publish: function(tree, ref, publishBranch) {\n        var message;\n        if (ref == null) {\n          ref = self.branch();\n        }\n        if (publishBranch == null) {\n          publishBranch = self.publishBranch();\n        }\n        message = \"\" + (emojis()) + \" Built \" + ref + \" in browser in strd6.github.io/editor\";\n        return self.ensurePublishBranch(publishBranch).then(function() {\n          return self.commitTree({\n            baseTree: true,\n            tree: tree,\n            branch: publishBranch\n          });\n        });\n      }\n    });\n    Object.extend(self, {\n      get: get,\n      put: put,\n      post: post,\n      patch: patch\n    });\n    return self;\n  };\n\n  module.exports = Repository;\n\n  cacheBuster = function() {\n    return \"?\" + (+(new Date));\n  };\n\n}).call(this);\n\n//# sourceURL=repository.coffee",
          "type": "blob"
        },
        "test/github": {
          "path": "test/github",
          "content": "(function() {\n  window.Github = require(\"../main\");\n\n  describe(\"Github\", function() {\n    it(\"Should be able to construct repositories\", function() {\n      assert(Github().repository);\n      return assert(Github().Repository);\n    });\n    it(\"should have authorizationUrl as an instance method\", function() {\n      return assert(Github().authorizationUrl);\n    });\n    return describe(\"Repository\", function() {\n      var expectUrlToMatch, expected, repository, testRequester;\n      expected = null;\n      expectUrlToMatch = function(regex) {\n        return expected = regex;\n      };\n      testRequester = function(url, data) {\n        var match;\n        match = url.match(expected);\n        assert.equal(!!match, true, \"\" + url + \" did not match \" + expected + \", \" + match);\n        return {\n          then: function() {}\n        };\n      };\n      repository = Github().Repository({\n        url: \"STRd6/testin\",\n        requester: testRequester\n      });\n      it(\"should cache bust the latest commit\", function() {\n        expectUrlToMatch(/.*\\?\\d+/);\n        return repository.latestCommit();\n      });\n      return it(\"should create a merge when asked\", function() {\n        expectUrlToMatch(/STRd6\\/testin\\/merges/);\n        return repository.mergeInto();\n      });\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/github.coffee",
          "type": "blob"
        }
      },
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "version": "0.4.2",
      "entryPoint": "main",
      "remoteDependencies": [
        "https://code.jquery.com/jquery-1.10.1.min.js",
        "http://strd6.github.io/tempest/javascripts/envweb-v0.4.5.js"
      ],
      "repository": {
        "id": 12910229,
        "name": "github",
        "full_name": "STRd6/github",
        "owner": {
          "login": "STRd6",
          "id": 18894,
          "avatar_url": "https://gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
          "gravatar_id": "33117162fff8a9cf50544a604f60c045",
          "url": "https://api.github.com/users/STRd6",
          "html_url": "https://github.com/STRd6",
          "followers_url": "https://api.github.com/users/STRd6/followers",
          "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
          "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
          "organizations_url": "https://api.github.com/users/STRd6/orgs",
          "repos_url": "https://api.github.com/users/STRd6/repos",
          "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
          "received_events_url": "https://api.github.com/users/STRd6/received_events",
          "type": "User",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/STRd6/github",
        "description": "Github API for online IDEs",
        "fork": false,
        "url": "https://api.github.com/repos/STRd6/github",
        "forks_url": "https://api.github.com/repos/STRd6/github/forks",
        "keys_url": "https://api.github.com/repos/STRd6/github/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/STRd6/github/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/STRd6/github/teams",
        "hooks_url": "https://api.github.com/repos/STRd6/github/hooks",
        "issue_events_url": "https://api.github.com/repos/STRd6/github/issues/events{/number}",
        "events_url": "https://api.github.com/repos/STRd6/github/events",
        "assignees_url": "https://api.github.com/repos/STRd6/github/assignees{/user}",
        "branches_url": "https://api.github.com/repos/STRd6/github/branches{/branch}",
        "tags_url": "https://api.github.com/repos/STRd6/github/tags",
        "blobs_url": "https://api.github.com/repos/STRd6/github/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/STRd6/github/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/STRd6/github/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/STRd6/github/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/STRd6/github/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/STRd6/github/languages",
        "stargazers_url": "https://api.github.com/repos/STRd6/github/stargazers",
        "contributors_url": "https://api.github.com/repos/STRd6/github/contributors",
        "subscribers_url": "https://api.github.com/repos/STRd6/github/subscribers",
        "subscription_url": "https://api.github.com/repos/STRd6/github/subscription",
        "commits_url": "https://api.github.com/repos/STRd6/github/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/STRd6/github/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/STRd6/github/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/STRd6/github/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/STRd6/github/contents/{+path}",
        "compare_url": "https://api.github.com/repos/STRd6/github/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/STRd6/github/merges",
        "archive_url": "https://api.github.com/repos/STRd6/github/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/STRd6/github/downloads",
        "issues_url": "https://api.github.com/repos/STRd6/github/issues{/number}",
        "pulls_url": "https://api.github.com/repos/STRd6/github/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/STRd6/github/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/STRd6/github/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/STRd6/github/labels{/name}",
        "releases_url": "https://api.github.com/repos/STRd6/github/releases{/id}",
        "created_at": "2013-09-18T00:25:56Z",
        "updated_at": "2013-12-03T21:40:15Z",
        "pushed_at": "2013-12-03T21:40:05Z",
        "git_url": "git://github.com/STRd6/github.git",
        "ssh_url": "git@github.com:STRd6/github.git",
        "clone_url": "https://github.com/STRd6/github.git",
        "svn_url": "https://github.com/STRd6/github",
        "homepage": null,
        "size": 696,
        "stargazers_count": 0,
        "watchers_count": 0,
        "language": "CoffeeScript",
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "default_branch": "master",
        "master_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "network_count": 0,
        "subscribers_count": 1,
        "branch": "v0.4.2",
        "defaultBranch": "master"
      },
      "dependencies": {
        "emojer": {
          "source": {
            "LICENSE": {
              "path": "LICENSE",
              "mode": "100644",
              "content": "The MIT License (MIT)\n\nCopyright (c) 2013 CanastaNasty\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
              "type": "blob"
            },
            "README.md": {
              "path": "README.md",
              "mode": "100644",
              "content": "emojer\n======\n\nRandomly returns a Github emoji\n",
              "type": "blob"
            },
            "main.js": {
              "path": "main.js",
              "mode": "100644",
              "content": "var emojis = \n  [\":bowtie:\"\n\t,\":smile:\"\n\t,\":laughing:\"\n\t,\":blush:\"\n\t,\":smiley:\"\n\t,\":relaxed:\"\n\t,\":smirk:\"\n\t,\":heart_eyes:\"\n\t,\":kissing_heart:\"\n\t,\":kissing_closed_eyes:\"\n\t,\":flushed:\"\n\t,\":relieved:\"\n\t,\":satisfied:\"\n\t,\":grin:\"\n\t,\":wink:\"\n\t,\":stuck_out_tongue_winking_eye:\"\n\t,\":stuck_out_tongue_closed_eyes:\"\n\t,\":grinning:\"\n\t,\":kissing:\"\n\t,\":kissing_smiling_eyes:\"\n\t,\":stuck_out_tongue:\"\n\t,\":sleeping:\"\n\t,\":worried:\"\n\t,\":frowning:\"\n\t,\":anguished:\"\n\t,\":open_mouth:\"\n\t,\":grimacing:\"\n\t,\":confused:\"\n\t,\":hushed:\"\n\t,\":expressionless:\"\n\t,\":unamused:\"\n\t,\":sweat_smile:\"\n\t,\":sweat:\"\n\t,\":disappointed_relieved:\"\n\t,\":weary:\"\n\t,\":pensive:\"\n\t,\":disappointed:\"\n\t,\":confounded:\"\n\t,\":fearful:\"\n\t,\":cold_sweat:\"\n\t,\":persevere:\"\n\t,\":cry:\"\n\t,\":sob:\"\n\t,\":joy:\"\n\t,\":astonished:\"\n\t,\":scream:\"\n\t,\":neckbeard:\"\n\t,\":tired_face:\"\n\t,\":angry:\"\n\t,\":rage:\"\n\t,\":triumph:\"\n\t,\":sleepy:\"\n\t,\":yum:\"\n\t,\":mask:\"\n\t,\":sunglasses:\"\n\t,\":dizzy_face:\"\n\t,\":imp:\"\n\t,\":smiling_imp:\"\n\t,\":neutral_face:\"\n\t,\":no_mouth:\"\n\t,\":innocent:\"\n\t,\":alien:\"\n\t,\":yellow_heart:\"\n\t,\":blue_heart:\"\n\t,\":purple_heart:\"\n\t,\":heart:\"\n\t,\":green_heart:\"\n\t,\":broken_heart:\"\n\t,\":heartbeat:\"\n\t,\":heartpulse:\"\n\t,\":two_hearts:\"\n\t,\":revolving_hearts:\"\n\t,\":cupid:\"\n\t,\":sparkling_heart:\"\n\t,\":sparkles:\"\n\t,\":star:\"\n\t,\":star2:\"\n\t,\":dizzy:\"\n\t,\":boom:\"\n\t,\":collision:\"\n\t,\":anger:\"\n\t,\":exclamation:\"\n\t,\":question:\"\n\t,\":grey_exclamation:\"\n\t,\":grey_question:\"\n\t,\":zzz:\"\n\t,\":dash:\"\n\t,\":sweat_drops:\"\n\t,\":notes:\"\n\t,\":musical_note:\"\n\t,\":fire:\"\n\t,\":hankey:\"\n\t,\":poop:\"\n\t,\":shit:\"\n\t,\":+1:\"\n\t,\":thumbsup:\"\n\t,\":-1:\"\n\t,\":thumbsdown:\"\n\t,\":ok_hand:\"\n\t,\":punch:\"\n\t,\":facepunch:\"\n\t,\":fist:\"\n\t,\":v:\"\n\t,\":wave:\"\n\t,\":hand:\"\n\t,\":raised_hand:\"\n\t,\":open_hands:\"\n\t,\":point_up:\"\n\t,\":point_down:\"\n\t,\":point_left:\"\n\t,\":point_right:\"\n\t,\":raised_hands:\"\n\t,\":pray:\"\n\t,\":point_up_2:\"\n\t,\":clap:\"\n\t,\":muscle:\"\n\t,\":metal:\"\n\t,\":fu:\"\n\t,\":walking:\"\n\t,\":runner:\"\n\t,\":running:\"\n\t,\":couple:\"\n\t,\":family:\"\n\t,\":two_men_holding_hands:\"\n\t,\":two_women_holding_hands:\"\n\t,\":dancer:\"\n\t,\":dancers:\"\n\t,\":ok_woman:\"\n\t,\":no_good:\"\n\t,\":information_desk_person:\"\n\t,\":raising_hand:\"\n\t,\":bride_with_veil:\"\n\t,\":person_with_pouting_face:\"\n\t,\":person_frowning:\"\n\t,\":bow:\"\n\t,\":couplekiss:\"\n\t,\":couple_with_heart:\"\n\t,\":massage:\"\n\t,\":haircut:\"\n\t,\":nail_care:\"\n\t,\":boy:\"\n\t,\":girl:\"\n\t,\":woman:\"\n\t,\":man:\"\n\t,\":baby:\"\n\t,\":older_woman:\"\n\t,\":older_man:\"\n\t,\":person_with_blond_hair:\"\n\t,\":man_with_gua_pi_mao:\"\n\t,\":man_with_turban:\"\n\t,\":construction_worker:\"\n\t,\":cop:\"\n\t,\":angel:\"\n\t,\":princess:\"\n\t,\":smiley_cat:\"\n\t,\":smile_cat:\"\n\t,\":heart_eyes_cat:\"\n\t,\":kissing_cat:\"\n\t,\":smirk_cat:\"\n\t,\":scream_cat:\"\n\t,\":crying_cat_face:\"\n\t,\":joy_cat:\"\n\t,\":pouting_cat:\"\n\t,\":japanese_ogre:\"\n\t,\":japanese_goblin:\"\n\t,\":see_no_evil:\"\n\t,\":hear_no_evil:\"\n\t,\":speak_no_evil:\"\n\t,\":guardsman:\"\n\t,\":skull:\"\n\t,\":feet:\"\n\t,\":lips:\"\n\t,\":kiss:\"\n\t,\":droplet:\"\n\t,\":ear:\"\n\t,\":eyes:\"\n\t,\":nose:\"\n\t,\":tongue:\"\n\t,\":love_letter:\"\n\t,\":bust_in_silhouette:\"\n\t,\":busts_in_silhouette:\"\n\t,\":speech_balloon:\"\n\t,\":thought_balloon:\"\n\t,\":feelsgood:\"\n\t,\":finnadie:\"\n\t,\":goberserk:\"\n\t,\":godmode:\"\n\t,\":hurtrealbad:\"\n\t,\":rage1:\"\n\t,\":rage2:\"\n\t,\":rage3:\"\n\t,\":rage4:\"\n\t,\":suspect:\"\n\t,\":trollface:\"\n\t,\":sunny:\"\n\t,\":umbrella:\"\n\t,\":cloud:\"\n\t,\":snowflake:\"\n\t,\":snowman:\"\n\t,\":zap:\"\n\t,\":cyclone:\"\n\t,\":foggy:\"\n\t,\":ocean:\"\n\t,\":cat:\"\n\t,\":dog:\"\n\t,\":mouse:\"\n\t,\":hamster:\"\n\t,\":rabbit:\"\n\t,\":wolf:\"\n\t,\":frog:\"\n\t,\":tiger:\"\n\t,\":koala:\"\n\t,\":bear:\"\n\t,\":pig:\"\n\t,\":pig_nose:\"\n\t,\":cow:\"\n\t,\":boar:\"\n\t,\":monkey_face:\"\n\t,\":monkey:\"\n\t,\":horse:\"\n\t,\":racehorse:\"\n\t,\":camel:\"\n\t,\":sheep:\"\n\t,\":elephant:\"\n\t,\":panda_face:\"\n\t,\":snake:\"\n\t,\":bird:\"\n\t,\":baby_chick:\"\n\t,\":hatched_chick:\"\n\t,\":hatching_chick:\"\n\t,\":chicken:\"\n\t,\":penguin:\"\n\t,\":turtle:\"\n\t,\":bug:\"\n\t,\":honeybee:\"\n\t,\":ant:\"\n\t,\":beetle:\"\n\t,\":snail:\"\n\t,\":octopus:\"\n\t,\":tropical_fish:\"\n\t,\":fish:\"\n\t,\":whale:\"\n\t,\":whale2:\"\n\t,\":dolphin:\"\n\t,\":cow2:\"\n\t,\":ram:\"\n\t,\":rat:\"\n\t,\":water_buffalo:\"\n\t,\":tiger2:\"\n\t,\":rabbit2:\"\n\t,\":dragon:\"\n\t,\":goat:\"\n\t,\":rooster:\"\n\t,\":dog2:\"\n\t,\":pig2:\"\n\t,\":mouse2:\"\n\t,\":ox:\"\n\t,\":dragon_face:\"\n\t,\":blowfish:\"\n\t,\":crocodile:\"\n\t,\":dromedary_camel:\"\n\t,\":leopard:\"\n\t,\":cat2:\"\n\t,\":poodle:\"\n\t,\":paw_prints:\"\n\t,\":bouquet:\"\n\t,\":cherry_blossom:\"\n\t,\":tulip:\"\n\t,\":four_leaf_clover:\"\n\t,\":rose:\"\n\t,\":sunflower:\"\n\t,\":hibiscus:\"\n\t,\":maple_leaf:\"\n\t,\":leaves:\"\n\t,\":fallen_leaf:\"\n\t,\":herb:\"\n\t,\":mushroom:\"\n\t,\":cactus:\"\n\t,\":palm_tree:\"\n\t,\":evergreen_tree:\"\n\t,\":deciduous_tree:\"\n\t,\":chestnut:\"\n\t,\":seedling:\"\n\t,\":blossom:\"\n\t,\":ear_of_rice:\"\n\t,\":shell:\"\n\t,\":globe_with_meridians:\"\n\t,\":sun_with_face:\"\n\t,\":full_moon_with_face:\"\n\t,\":new_moon_with_face:\"\n\t,\":new_moon:\"\n\t,\":waxing_crescent_moon:\"\n\t,\":first_quarter_moon:\"\n\t,\":waxing_gibbous_moon:\"\n\t,\":full_moon:\"\n\t,\":waning_gibbous_moon:\"\n\t,\":last_quarter_moon:\"\n\t,\":waning_crescent_moon:\"\n\t,\":last_quarter_moon_with_face:\"\n\t,\":first_quarter_moon_with_face:\"\n\t,\":moon:\"\n\t,\":earth_africa:\"\n\t,\":earth_americas:\"\n\t,\":earth_asia:\"\n\t,\":volcano:\"\n\t,\":milky_way:\"\n\t,\":partly_sunny:\"\n\t,\":octocat:\"\n\t,\":squirrel:\"\n\t,\":bamboo:\"\n\t,\":gift_heart:\"\n\t,\":dolls:\"\n\t,\":school_satchel:\"\n\t,\":mortar_board:\"\n\t,\":flags:\"\n\t,\":fireworks:\"\n\t,\":sparkler:\"\n\t,\":wind_chime:\"\n\t,\":rice_scene:\"\n\t,\":jack_o_lantern:\"\n\t,\":ghost:\"\n\t,\":santa:\"\n\t,\":christmas_tree:\"\n\t,\":gift:\"\n\t,\":bell:\"\n\t,\":no_bell:\"\n\t,\":tanabata_tree:\"\n\t,\":tada:\"\n\t,\":confetti_ball:\"\n\t,\":balloon:\"\n\t,\":crystal_ball:\"\n\t,\":cd:\"\n\t,\":dvd:\"\n\t,\":floppy_disk:\"\n\t,\":camera:\"\n\t,\":video_camera:\"\n\t,\":movie_camera:\"\n\t,\":computer:\"\n\t,\":tv:\"\n\t,\":iphone:\"\n\t,\":phone:\"\n\t,\":telephone:\"\n\t,\":telephone_receiver:\"\n\t,\":pager:\"\n\t,\":fax:\"\n\t,\":minidisc:\"\n\t,\":vhs:\"\n\t,\":sound:\"\n\t,\":speaker:\"\n\t,\":mute:\"\n\t,\":loudspeaker:\"\n\t,\":mega:\"\n\t,\":hourglass:\"\n\t,\":hourglass_flowing_sand:\"\n\t,\":alarm_clock:\"\n\t,\":watch:\"\n\t,\":radio:\"\n\t,\":satellite:\"\n\t,\":loop:\"\n\t,\":mag:\"\n\t,\":mag_right:\"\n\t,\":unlock:\"\n\t,\":lock:\"\n\t,\":lock_with_ink_pen:\"\n\t,\":closed_lock_with_key:\"\n\t,\":key:\"\n\t,\":bulb:\"\n\t,\":flashlight:\"\n\t,\":high_brightness:\"\n\t,\":low_brightness:\"\n\t,\":electric_plug:\"\n\t,\":battery:\"\n\t,\":calling:\"\n\t,\":email:\"\n\t,\":mailbox:\"\n\t,\":postbox:\"\n\t,\":bath:\"\n\t,\":bathtub:\"\n\t,\":shower:\"\n\t,\":toilet:\"\n\t,\":wrench:\"\n\t,\":nut_and_bolt:\"\n\t,\":hammer:\"\n\t,\":seat:\"\n\t,\":moneybag:\"\n\t,\":yen:\"\n\t,\":dollar:\"\n\t,\":pound:\"\n\t,\":euro:\"\n\t,\":credit_card:\"\n\t,\":money_with_wings:\"\n\t,\":e-mail:\"\n\t,\":inbox_tray:\"\n\t,\":outbox_tray:\"\n\t,\":envelope:\"\n\t,\":incoming_envelope:\"\n\t,\":postal_horn:\"\n\t,\":mailbox_closed:\"\n\t,\":mailbox_with_mail:\"\n\t,\":mailbox_with_no_mail:\"\n\t,\":door:\"\n\t,\":smoking:\"\n\t,\":bomb:\"\n\t,\":gun:\"\n\t,\":hocho:\"\n\t,\":pill:\"\n\t,\":syringe:\"\n\t,\":page_facing_up:\"\n\t,\":page_with_curl:\"\n\t,\":bookmark_tabs:\"\n\t,\":bar_chart:\"\n\t,\":chart_with_upwards_trend:\"\n\t,\":chart_with_downwards_trend:\"\n\t,\":scroll:\"\n\t,\":clipboard:\"\n\t,\":calendar:\"\n\t,\":date:\"\n\t,\":card_index:\"\n\t,\":file_folder:\"\n\t,\":open_file_folder:\"\n\t,\":scissors:\"\n\t,\":pushpin:\"\n\t,\":paperclip:\"\n\t,\":black_nib:\"\n\t,\":pencil2:\"\n\t,\":straight_ruler:\"\n\t,\":triangular_ruler:\"\n\t,\":closed_book:\"\n\t,\":green_book:\"\n\t,\":blue_book:\"\n\t,\":orange_book:\"\n\t,\":notebook:\"\n\t,\":notebook_with_decorative_cover:\"\n\t,\":ledger:\"\n\t,\":books:\"\n\t,\":bookmark:\"\n\t,\":name_badge:\"\n\t,\":microscope:\"\n\t,\":telescope:\"\n\t,\":newspaper:\"\n\t,\":football:\"\n\t,\":basketball:\"\n\t,\":soccer:\"\n\t,\":baseball:\"\n\t,\":tennis:\"\n\t,\":8ball:\"\n\t,\":rugby_football:\"\n\t,\":bowling:\"\n\t,\":golf:\"\n\t,\":mountain_bicyclist:\"\n\t,\":bicyclist:\"\n\t,\":horse_racing:\"\n\t,\":snowboarder:\"\n\t,\":swimmer:\"\n\t,\":surfer:\"\n\t,\":ski:\"\n\t,\":spades:\"\n\t,\":hearts:\"\n\t,\":clubs:\"\n\t,\":diamonds:\"\n\t,\":gem:\"\n\t,\":ring:\"\n\t,\":trophy:\"\n\t,\":musical_score:\"\n\t,\":musical_keyboard:\"\n\t,\":violin:\"\n\t,\":space_invader:\"\n\t,\":video_game:\"\n\t,\":black_joker:\"\n\t,\":flower_playing_cards:\"\n\t,\":game_die:\"\n\t,\":dart:\"\n\t,\":mahjong:\"\n\t,\":clapper:\"\n\t,\":memo:\"\n\t,\":pencil:\"\n\t,\":book:\"\n\t,\":art:\"\n\t,\":microphone:\"\n\t,\":headphones:\"\n\t,\":trumpet:\"\n\t,\":saxophone:\"\n\t,\":guitar:\"\n\t,\":shoe:\"\n\t,\":sandal:\"\n\t,\":high_heel:\"\n\t,\":lipstick:\"\n\t,\":boot:\"\n\t,\":shirt:\"\n\t,\":tshirt:\"\n\t,\":necktie:\"\n\t,\":womans_clothes:\"\n\t,\":dress:\"\n\t,\":running_shirt_with_sash:\"\n\t,\":jeans:\"\n\t,\":kimono:\"\n\t,\":bikini:\"\n\t,\":ribbon:\"\n\t,\":tophat:\"\n\t,\":crown:\"\n\t,\":womans_hat:\"\n\t,\":mans_shoe:\"\n\t,\":closed_umbrella:\"\n\t,\":briefcase:\"\n\t,\":handbag:\"\n\t,\":pouch:\"\n\t,\":purse:\"\n\t,\":eyeglasses:\"\n\t,\":fishing_pole_and_fish:\"\n\t,\":coffee:\"\n\t,\":tea:\"\n\t,\":sake:\"\n\t,\":baby_bottle:\"\n\t,\":beer:\"\n\t,\":beers:\"\n\t,\":cocktail:\"\n\t,\":tropical_drink:\"\n\t,\":wine_glass:\"\n\t,\":fork_and_knife:\"\n\t,\":pizza:\"\n\t,\":hamburger:\"\n\t,\":fries:\"\n\t,\":poultry_leg:\"\n\t,\":meat_on_bone:\"\n\t,\":spaghetti:\"\n\t,\":curry:\"\n\t,\":fried_shrimp:\"\n\t,\":bento:\"\n\t,\":sushi:\"\n\t,\":fish_cake:\"\n\t,\":rice_ball:\"\n\t,\":rice_cracker:\"\n\t,\":rice:\"\n\t,\":ramen:\"\n\t,\":stew:\"\n\t,\":oden:\"\n\t,\":dango:\"\n\t,\":egg:\"\n\t,\":bread:\"\n\t,\":doughnut:\"\n\t,\":custard:\"\n\t,\":icecream:\"\n\t,\":ice_cream:\"\n\t,\":shaved_ice:\"\n\t,\":birthday:\"\n\t,\":cake:\"\n\t,\":cookie:\"\n\t,\":chocolate_bar:\"\n\t,\":candy:\"\n\t,\":lollipop:\"\n\t,\":honey_pot:\"\n\t,\":apple:\"\n\t,\":green_apple:\"\n\t,\":tangerine:\"\n\t,\":lemon:\"\n\t,\":cherries:\"\n\t,\":grapes:\"\n\t,\":watermelon:\"\n\t,\":strawberry:\"\n\t,\":peach:\"\n\t,\":melon:\"\n\t,\":banana:\"\n\t,\":pear:\"\n\t,\":pineapple:\"\n\t,\":sweet_potato:\"\n\t,\":eggplant:\"\n\t,\":tomato:\"\n\t,\":corn:\"\n\t,\":house:\"\n\t,\":house_with_garden:\"\n\t,\":school:\"\n\t,\":office:\"\n\t,\":post_office:\"\n\t,\":hospital:\"\n\t,\":bank:\"\n\t,\":convenience_store:\"\n\t,\":love_hotel:\"\n\t,\":hotel:\"\n\t,\":wedding:\"\n\t,\":church:\"\n\t,\":department_store:\"\n\t,\":european_post_office:\"\n\t,\":city_sunrise:\"\n\t,\":city_sunset:\"\n\t,\":japanese_castle:\"\n\t,\":european_castle:\"\n\t,\":tent:\"\n\t,\":factory:\"\n\t,\":tokyo_tower:\"\n\t,\":japan:\"\n\t,\":mount_fuji:\"\n\t,\":sunrise_over_mountains:\"\n\t,\":sunrise:\"\n\t,\":stars:\"\n\t,\":statue_of_liberty:\"\n\t,\":bridge_at_night:\"\n\t,\":carousel_horse:\"\n\t,\":rainbow:\"\n\t,\":ferris_wheel:\"\n\t,\":fountain:\"\n\t,\":roller_coaster:\"\n\t,\":ship:\"\n\t,\":speedboat:\"\n\t,\":boat:\"\n\t,\":sailboat:\"\n\t,\":rowboat:\"\n\t,\":anchor:\"\n\t,\":rocket:\"\n\t,\":airplane:\"\n\t,\":helicopter:\"\n\t,\":steam_locomotive:\"\n\t,\":tram:\"\n\t,\":mountain_railway:\"\n\t,\":bike:\"\n\t,\":aerial_tramway:\"\n\t,\":suspension_railway:\"\n\t,\":mountain_cableway:\"\n\t,\":tractor:\"\n\t,\":blue_car:\"\n\t,\":oncoming_automobile:\"\n\t,\":car:\"\n\t,\":red_car:\"\n\t,\":taxi:\"\n\t,\":oncoming_taxi:\"\n\t,\":articulated_lorry:\"\n\t,\":bus:\"\n\t,\":oncoming_bus:\"\n\t,\":rotating_light:\"\n\t,\":police_car:\"\n\t,\":oncoming_police_car:\"\n\t,\":fire_engine:\"\n\t,\":ambulance:\"\n\t,\":minibus:\"\n\t,\":truck:\"\n\t,\":train:\"\n\t,\":station:\"\n\t,\":train2:\"\n\t,\":bullettrain_front:\"\n\t,\":bullettrain_side:\"\n\t,\":light_rail:\"\n\t,\":monorail:\"\n\t,\":railway_car:\"\n\t,\":trolleybus:\"\n\t,\":ticket:\"\n\t,\":fuelpump:\"\n\t,\":vertical_traffic_light:\"\n\t,\":traffic_light:\"\n\t,\":warning:\"\n\t,\":construction:\"\n\t,\":beginner:\"\n\t,\":atm:\"\n\t,\":slot_machine:\"\n\t,\":busstop:\"\n\t,\":barber:\"\n\t,\":hotsprings:\"\n\t,\":checkered_flag:\"\n\t,\":crossed_flags:\"\n\t,\":izakaya_lantern:\"\n\t,\":moyai:\"\n\t,\":circus_tent:\"\n\t,\":performing_arts:\"\n\t,\":round_pushpin:\"\n\t,\":triangular_flag_on_post:\"\n\t,\":jp:\"\n\t,\":kr:\"\n\t,\":cn:\"\n\t,\":us:\"\n\t,\":fr:\"\n\t,\":es:\"\n\t,\":it:\"\n\t,\":ru:\"\n\t,\":gb:\"\n\t,\":uk:\"\n\t,\":de:\"\n\t,\":one:\"\n\t,\":two:\"\n\t,\":three:\"\n\t,\":four:\"\n\t,\":five:\"\n\t,\":six:\"\n\t,\":seven:\"\n\t,\":eight:\"\n\t,\":nine:\"\n\t,\":keycap_ten:\"\n\t,\":1234:\"\n\t,\":zero:\"\n\t,\":hash:\"\n\t,\":symbols:\"\n\t,\":arrow_backward:\"\n\t,\":arrow_down:\"\n\t,\":arrow_forward:\"\n\t,\":arrow_left:\"\n\t,\":capital_abcd:\"\n\t,\":abcd:\"\n\t,\":abc:\"\n\t,\":arrow_lower_left:\"\n\t,\":arrow_lower_right:\"\n\t,\":arrow_right:\"\n\t,\":arrow_up:\"\n\t,\":arrow_upper_left:\"\n\t,\":arrow_upper_right:\"\n\t,\":arrow_double_down:\"\n\t,\":arrow_double_up:\"\n\t,\":arrow_down_small:\"\n\t,\":arrow_heading_down:\"\n\t,\":arrow_heading_up:\"\n\t,\":leftwards_arrow_with_hook:\"\n\t,\":arrow_right_hook:\"\n\t,\":left_right_arrow:\"\n\t,\":arrow_up_down:\"\n\t,\":arrow_up_small:\"\n\t,\":arrows_clockwise:\"\n\t,\":arrows_counterclockwise:\"\n\t,\":rewind:\"\n\t,\":fast_forward:\"\n\t,\":information_source:\"\n\t,\":ok:\"\n\t,\":twisted_rightwards_arrows:\"\n\t,\":repeat:\"\n\t,\":repeat_one:\"\n\t,\":new:\"\n\t,\":top:\"\n\t,\":up:\"\n\t,\":cool:\"\n\t,\":free:\"\n\t,\":ng:\"\n\t,\":cinema:\"\n\t,\":koko:\"\n\t,\":signal_strength:\"\n\t,\":u5272:\"\n\t,\":u5408:\"\n\t,\":u55b6:\"\n\t,\":u6307:\"\n\t,\":u6708:\"\n\t,\":u6709:\"\n\t,\":u6e80:\"\n\t,\":u7121:\"\n\t,\":u7533:\"\n\t,\":u7a7a:\"\n\t,\":u7981:\"\n\t,\":sa:\"\n\t,\":restroom:\"\n\t,\":mens:\"\n\t,\":womens:\"\n\t,\":baby_symbol:\"\n\t,\":no_smoking:\"\n\t,\":parking:\"\n\t,\":wheelchair:\"\n\t,\":metro:\"\n\t,\":baggage_claim:\"\n\t,\":accept:\"\n\t,\":wc:\"\n\t,\":potable_water:\"\n\t,\":put_litter_in_its_place:\"\n\t,\":secret:\"\n\t,\":congratulations:\"\n\t,\":m:\"\n\t,\":passport_control:\"\n\t,\":left_luggage:\"\n\t,\":customs:\"\n\t,\":ideograph_advantage:\"\n\t,\":cl:\"\n\t,\":sos:\"\n\t,\":id:\"\n\t,\":no_entry_sign:\"\n\t,\":underage:\"\n\t,\":no_mobile_phones:\"\n\t,\":do_not_litter:\"\n\t,\":non-potable_water:\"\n\t,\":no_bicycles:\"\n\t,\":no_pedestrians:\"\n\t,\":children_crossing:\"\n\t,\":no_entry:\"\n\t,\":eight_spoked_asterisk:\"\n\t,\":eight_pointed_black_star:\"\n\t,\":heart_decoration:\"\n\t,\":vs:\"\n\t,\":vibration_mode:\"\n\t,\":mobile_phone_off:\"\n\t,\":chart:\"\n\t,\":currency_exchange:\"\n\t,\":aries:\"\n\t,\":taurus:\"\n\t,\":gemini:\"\n\t,\":cancer:\"\n\t,\":leo:\"\n\t,\":virgo:\"\n\t,\":libra:\"\n\t,\":scorpius:\"\n\t,\":sagittarius:\"\n\t,\":capricorn:\"\n\t,\":aquarius:\"\n\t,\":pisces:\"\n\t,\":ophiuchus:\"\n\t,\":six_pointed_star:\"\n\t,\":negative_squared_cross_mark:\"\n\t,\":a:\"\n\t,\":b:\"\n\t,\":ab:\"\n\t,\":o2:\"\n\t,\":diamond_shape_with_a_dot_inside:\"\n\t,\":recycle:\"\n\t,\":end:\"\n\t,\":on:\"\n\t,\":soon:\"\n\t,\":clock1:\"\n\t,\":clock130:\"\n\t,\":clock10:\"\n\t,\":clock1030:\"\n\t,\":clock11:\"\n\t,\":clock1130:\"\n\t,\":clock12:\"\n\t,\":clock1230:\"\n\t,\":clock2:\"\n\t,\":clock230:\"\n\t,\":clock3:\"\n\t,\":clock330:\"\n\t,\":clock4:\"\n\t,\":clock430:\"\n\t,\":clock5:\"\n\t,\":clock530:\"\n\t,\":clock6:\"\n\t,\":clock630:\"\n\t,\":clock7:\"\n\t,\":clock730:\"\n\t,\":clock8:\"\n\t,\":clock830:\"\n\t,\":clock9:\"\n\t,\":clock930:\"\n\t,\":heavy_dollar_sign:\"\n\t,\":copyright:\"\n\t,\":registered:\"\n\t,\":tm:\"\n\t,\":x:\"\n\t,\":heavy_exclamation_mark:\"\n\t,\":bangbang:\"\n\t,\":interrobang:\"\n\t,\":o:\"\n\t,\":heavy_multiplication_x:\"\n\t,\":heavy_plus_sign:\"\n\t,\":heavy_minus_sign:\"\n\t,\":heavy_division_sign:\"\n\t,\":white_flower:\"\n\t,\":100:\"\n\t,\":heavy_check_mark:\"\n\t,\":ballot_box_with_check:\"\n\t,\":radio_button:\"\n\t,\":link:\"\n\t,\":curly_loop:\"\n\t,\":wavy_dash:\"\n\t,\":part_alternation_mark:\"\n\t,\":trident:\"\n\t,\":black_square:\"\n\t,\":white_square:\"\n\t,\":white_check_mark:\"\n\t,\":black_square_button:\"\n\t,\":white_square_button:\"\n\t,\":black_circle:\"\n\t,\":white_circle:\"\n\t,\":red_circle:\"\n\t,\":large_blue_circle:\"\n\t,\":large_blue_diamond:\"\n\t,\":large_orange_diamond:\"\n\t,\":small_blue_diamond:\"\n\t,\":small_orange_diamond:\"\n\t,\":small_red_triangle:\"\n\t,\":small_red_triangle_down:\"\n\t,\":shipit:\"\n]\n\nfunction emojer () {\n\tindex = Math.floor(Math.random()*emojis.length)\n\treturn emojis[index]\n}\n\nmodule.exports = emojer\n",
              "type": "blob"
            },
            "pixie.cson": {
              "path": "pixie.cson",
              "mode": "100644",
              "content": "version: \"0.2.0\"\n",
              "type": "blob"
            }
          },
          "distribution": {
            "main": {
              "path": "main",
              "content": "var emojis = \n  [\":bowtie:\"\n\t,\":smile:\"\n\t,\":laughing:\"\n\t,\":blush:\"\n\t,\":smiley:\"\n\t,\":relaxed:\"\n\t,\":smirk:\"\n\t,\":heart_eyes:\"\n\t,\":kissing_heart:\"\n\t,\":kissing_closed_eyes:\"\n\t,\":flushed:\"\n\t,\":relieved:\"\n\t,\":satisfied:\"\n\t,\":grin:\"\n\t,\":wink:\"\n\t,\":stuck_out_tongue_winking_eye:\"\n\t,\":stuck_out_tongue_closed_eyes:\"\n\t,\":grinning:\"\n\t,\":kissing:\"\n\t,\":kissing_smiling_eyes:\"\n\t,\":stuck_out_tongue:\"\n\t,\":sleeping:\"\n\t,\":worried:\"\n\t,\":frowning:\"\n\t,\":anguished:\"\n\t,\":open_mouth:\"\n\t,\":grimacing:\"\n\t,\":confused:\"\n\t,\":hushed:\"\n\t,\":expressionless:\"\n\t,\":unamused:\"\n\t,\":sweat_smile:\"\n\t,\":sweat:\"\n\t,\":disappointed_relieved:\"\n\t,\":weary:\"\n\t,\":pensive:\"\n\t,\":disappointed:\"\n\t,\":confounded:\"\n\t,\":fearful:\"\n\t,\":cold_sweat:\"\n\t,\":persevere:\"\n\t,\":cry:\"\n\t,\":sob:\"\n\t,\":joy:\"\n\t,\":astonished:\"\n\t,\":scream:\"\n\t,\":neckbeard:\"\n\t,\":tired_face:\"\n\t,\":angry:\"\n\t,\":rage:\"\n\t,\":triumph:\"\n\t,\":sleepy:\"\n\t,\":yum:\"\n\t,\":mask:\"\n\t,\":sunglasses:\"\n\t,\":dizzy_face:\"\n\t,\":imp:\"\n\t,\":smiling_imp:\"\n\t,\":neutral_face:\"\n\t,\":no_mouth:\"\n\t,\":innocent:\"\n\t,\":alien:\"\n\t,\":yellow_heart:\"\n\t,\":blue_heart:\"\n\t,\":purple_heart:\"\n\t,\":heart:\"\n\t,\":green_heart:\"\n\t,\":broken_heart:\"\n\t,\":heartbeat:\"\n\t,\":heartpulse:\"\n\t,\":two_hearts:\"\n\t,\":revolving_hearts:\"\n\t,\":cupid:\"\n\t,\":sparkling_heart:\"\n\t,\":sparkles:\"\n\t,\":star:\"\n\t,\":star2:\"\n\t,\":dizzy:\"\n\t,\":boom:\"\n\t,\":collision:\"\n\t,\":anger:\"\n\t,\":exclamation:\"\n\t,\":question:\"\n\t,\":grey_exclamation:\"\n\t,\":grey_question:\"\n\t,\":zzz:\"\n\t,\":dash:\"\n\t,\":sweat_drops:\"\n\t,\":notes:\"\n\t,\":musical_note:\"\n\t,\":fire:\"\n\t,\":hankey:\"\n\t,\":poop:\"\n\t,\":shit:\"\n\t,\":+1:\"\n\t,\":thumbsup:\"\n\t,\":-1:\"\n\t,\":thumbsdown:\"\n\t,\":ok_hand:\"\n\t,\":punch:\"\n\t,\":facepunch:\"\n\t,\":fist:\"\n\t,\":v:\"\n\t,\":wave:\"\n\t,\":hand:\"\n\t,\":raised_hand:\"\n\t,\":open_hands:\"\n\t,\":point_up:\"\n\t,\":point_down:\"\n\t,\":point_left:\"\n\t,\":point_right:\"\n\t,\":raised_hands:\"\n\t,\":pray:\"\n\t,\":point_up_2:\"\n\t,\":clap:\"\n\t,\":muscle:\"\n\t,\":metal:\"\n\t,\":fu:\"\n\t,\":walking:\"\n\t,\":runner:\"\n\t,\":running:\"\n\t,\":couple:\"\n\t,\":family:\"\n\t,\":two_men_holding_hands:\"\n\t,\":two_women_holding_hands:\"\n\t,\":dancer:\"\n\t,\":dancers:\"\n\t,\":ok_woman:\"\n\t,\":no_good:\"\n\t,\":information_desk_person:\"\n\t,\":raising_hand:\"\n\t,\":bride_with_veil:\"\n\t,\":person_with_pouting_face:\"\n\t,\":person_frowning:\"\n\t,\":bow:\"\n\t,\":couplekiss:\"\n\t,\":couple_with_heart:\"\n\t,\":massage:\"\n\t,\":haircut:\"\n\t,\":nail_care:\"\n\t,\":boy:\"\n\t,\":girl:\"\n\t,\":woman:\"\n\t,\":man:\"\n\t,\":baby:\"\n\t,\":older_woman:\"\n\t,\":older_man:\"\n\t,\":person_with_blond_hair:\"\n\t,\":man_with_gua_pi_mao:\"\n\t,\":man_with_turban:\"\n\t,\":construction_worker:\"\n\t,\":cop:\"\n\t,\":angel:\"\n\t,\":princess:\"\n\t,\":smiley_cat:\"\n\t,\":smile_cat:\"\n\t,\":heart_eyes_cat:\"\n\t,\":kissing_cat:\"\n\t,\":smirk_cat:\"\n\t,\":scream_cat:\"\n\t,\":crying_cat_face:\"\n\t,\":joy_cat:\"\n\t,\":pouting_cat:\"\n\t,\":japanese_ogre:\"\n\t,\":japanese_goblin:\"\n\t,\":see_no_evil:\"\n\t,\":hear_no_evil:\"\n\t,\":speak_no_evil:\"\n\t,\":guardsman:\"\n\t,\":skull:\"\n\t,\":feet:\"\n\t,\":lips:\"\n\t,\":kiss:\"\n\t,\":droplet:\"\n\t,\":ear:\"\n\t,\":eyes:\"\n\t,\":nose:\"\n\t,\":tongue:\"\n\t,\":love_letter:\"\n\t,\":bust_in_silhouette:\"\n\t,\":busts_in_silhouette:\"\n\t,\":speech_balloon:\"\n\t,\":thought_balloon:\"\n\t,\":feelsgood:\"\n\t,\":finnadie:\"\n\t,\":goberserk:\"\n\t,\":godmode:\"\n\t,\":hurtrealbad:\"\n\t,\":rage1:\"\n\t,\":rage2:\"\n\t,\":rage3:\"\n\t,\":rage4:\"\n\t,\":suspect:\"\n\t,\":trollface:\"\n\t,\":sunny:\"\n\t,\":umbrella:\"\n\t,\":cloud:\"\n\t,\":snowflake:\"\n\t,\":snowman:\"\n\t,\":zap:\"\n\t,\":cyclone:\"\n\t,\":foggy:\"\n\t,\":ocean:\"\n\t,\":cat:\"\n\t,\":dog:\"\n\t,\":mouse:\"\n\t,\":hamster:\"\n\t,\":rabbit:\"\n\t,\":wolf:\"\n\t,\":frog:\"\n\t,\":tiger:\"\n\t,\":koala:\"\n\t,\":bear:\"\n\t,\":pig:\"\n\t,\":pig_nose:\"\n\t,\":cow:\"\n\t,\":boar:\"\n\t,\":monkey_face:\"\n\t,\":monkey:\"\n\t,\":horse:\"\n\t,\":racehorse:\"\n\t,\":camel:\"\n\t,\":sheep:\"\n\t,\":elephant:\"\n\t,\":panda_face:\"\n\t,\":snake:\"\n\t,\":bird:\"\n\t,\":baby_chick:\"\n\t,\":hatched_chick:\"\n\t,\":hatching_chick:\"\n\t,\":chicken:\"\n\t,\":penguin:\"\n\t,\":turtle:\"\n\t,\":bug:\"\n\t,\":honeybee:\"\n\t,\":ant:\"\n\t,\":beetle:\"\n\t,\":snail:\"\n\t,\":octopus:\"\n\t,\":tropical_fish:\"\n\t,\":fish:\"\n\t,\":whale:\"\n\t,\":whale2:\"\n\t,\":dolphin:\"\n\t,\":cow2:\"\n\t,\":ram:\"\n\t,\":rat:\"\n\t,\":water_buffalo:\"\n\t,\":tiger2:\"\n\t,\":rabbit2:\"\n\t,\":dragon:\"\n\t,\":goat:\"\n\t,\":rooster:\"\n\t,\":dog2:\"\n\t,\":pig2:\"\n\t,\":mouse2:\"\n\t,\":ox:\"\n\t,\":dragon_face:\"\n\t,\":blowfish:\"\n\t,\":crocodile:\"\n\t,\":dromedary_camel:\"\n\t,\":leopard:\"\n\t,\":cat2:\"\n\t,\":poodle:\"\n\t,\":paw_prints:\"\n\t,\":bouquet:\"\n\t,\":cherry_blossom:\"\n\t,\":tulip:\"\n\t,\":four_leaf_clover:\"\n\t,\":rose:\"\n\t,\":sunflower:\"\n\t,\":hibiscus:\"\n\t,\":maple_leaf:\"\n\t,\":leaves:\"\n\t,\":fallen_leaf:\"\n\t,\":herb:\"\n\t,\":mushroom:\"\n\t,\":cactus:\"\n\t,\":palm_tree:\"\n\t,\":evergreen_tree:\"\n\t,\":deciduous_tree:\"\n\t,\":chestnut:\"\n\t,\":seedling:\"\n\t,\":blossom:\"\n\t,\":ear_of_rice:\"\n\t,\":shell:\"\n\t,\":globe_with_meridians:\"\n\t,\":sun_with_face:\"\n\t,\":full_moon_with_face:\"\n\t,\":new_moon_with_face:\"\n\t,\":new_moon:\"\n\t,\":waxing_crescent_moon:\"\n\t,\":first_quarter_moon:\"\n\t,\":waxing_gibbous_moon:\"\n\t,\":full_moon:\"\n\t,\":waning_gibbous_moon:\"\n\t,\":last_quarter_moon:\"\n\t,\":waning_crescent_moon:\"\n\t,\":last_quarter_moon_with_face:\"\n\t,\":first_quarter_moon_with_face:\"\n\t,\":moon:\"\n\t,\":earth_africa:\"\n\t,\":earth_americas:\"\n\t,\":earth_asia:\"\n\t,\":volcano:\"\n\t,\":milky_way:\"\n\t,\":partly_sunny:\"\n\t,\":octocat:\"\n\t,\":squirrel:\"\n\t,\":bamboo:\"\n\t,\":gift_heart:\"\n\t,\":dolls:\"\n\t,\":school_satchel:\"\n\t,\":mortar_board:\"\n\t,\":flags:\"\n\t,\":fireworks:\"\n\t,\":sparkler:\"\n\t,\":wind_chime:\"\n\t,\":rice_scene:\"\n\t,\":jack_o_lantern:\"\n\t,\":ghost:\"\n\t,\":santa:\"\n\t,\":christmas_tree:\"\n\t,\":gift:\"\n\t,\":bell:\"\n\t,\":no_bell:\"\n\t,\":tanabata_tree:\"\n\t,\":tada:\"\n\t,\":confetti_ball:\"\n\t,\":balloon:\"\n\t,\":crystal_ball:\"\n\t,\":cd:\"\n\t,\":dvd:\"\n\t,\":floppy_disk:\"\n\t,\":camera:\"\n\t,\":video_camera:\"\n\t,\":movie_camera:\"\n\t,\":computer:\"\n\t,\":tv:\"\n\t,\":iphone:\"\n\t,\":phone:\"\n\t,\":telephone:\"\n\t,\":telephone_receiver:\"\n\t,\":pager:\"\n\t,\":fax:\"\n\t,\":minidisc:\"\n\t,\":vhs:\"\n\t,\":sound:\"\n\t,\":speaker:\"\n\t,\":mute:\"\n\t,\":loudspeaker:\"\n\t,\":mega:\"\n\t,\":hourglass:\"\n\t,\":hourglass_flowing_sand:\"\n\t,\":alarm_clock:\"\n\t,\":watch:\"\n\t,\":radio:\"\n\t,\":satellite:\"\n\t,\":loop:\"\n\t,\":mag:\"\n\t,\":mag_right:\"\n\t,\":unlock:\"\n\t,\":lock:\"\n\t,\":lock_with_ink_pen:\"\n\t,\":closed_lock_with_key:\"\n\t,\":key:\"\n\t,\":bulb:\"\n\t,\":flashlight:\"\n\t,\":high_brightness:\"\n\t,\":low_brightness:\"\n\t,\":electric_plug:\"\n\t,\":battery:\"\n\t,\":calling:\"\n\t,\":email:\"\n\t,\":mailbox:\"\n\t,\":postbox:\"\n\t,\":bath:\"\n\t,\":bathtub:\"\n\t,\":shower:\"\n\t,\":toilet:\"\n\t,\":wrench:\"\n\t,\":nut_and_bolt:\"\n\t,\":hammer:\"\n\t,\":seat:\"\n\t,\":moneybag:\"\n\t,\":yen:\"\n\t,\":dollar:\"\n\t,\":pound:\"\n\t,\":euro:\"\n\t,\":credit_card:\"\n\t,\":money_with_wings:\"\n\t,\":e-mail:\"\n\t,\":inbox_tray:\"\n\t,\":outbox_tray:\"\n\t,\":envelope:\"\n\t,\":incoming_envelope:\"\n\t,\":postal_horn:\"\n\t,\":mailbox_closed:\"\n\t,\":mailbox_with_mail:\"\n\t,\":mailbox_with_no_mail:\"\n\t,\":door:\"\n\t,\":smoking:\"\n\t,\":bomb:\"\n\t,\":gun:\"\n\t,\":hocho:\"\n\t,\":pill:\"\n\t,\":syringe:\"\n\t,\":page_facing_up:\"\n\t,\":page_with_curl:\"\n\t,\":bookmark_tabs:\"\n\t,\":bar_chart:\"\n\t,\":chart_with_upwards_trend:\"\n\t,\":chart_with_downwards_trend:\"\n\t,\":scroll:\"\n\t,\":clipboard:\"\n\t,\":calendar:\"\n\t,\":date:\"\n\t,\":card_index:\"\n\t,\":file_folder:\"\n\t,\":open_file_folder:\"\n\t,\":scissors:\"\n\t,\":pushpin:\"\n\t,\":paperclip:\"\n\t,\":black_nib:\"\n\t,\":pencil2:\"\n\t,\":straight_ruler:\"\n\t,\":triangular_ruler:\"\n\t,\":closed_book:\"\n\t,\":green_book:\"\n\t,\":blue_book:\"\n\t,\":orange_book:\"\n\t,\":notebook:\"\n\t,\":notebook_with_decorative_cover:\"\n\t,\":ledger:\"\n\t,\":books:\"\n\t,\":bookmark:\"\n\t,\":name_badge:\"\n\t,\":microscope:\"\n\t,\":telescope:\"\n\t,\":newspaper:\"\n\t,\":football:\"\n\t,\":basketball:\"\n\t,\":soccer:\"\n\t,\":baseball:\"\n\t,\":tennis:\"\n\t,\":8ball:\"\n\t,\":rugby_football:\"\n\t,\":bowling:\"\n\t,\":golf:\"\n\t,\":mountain_bicyclist:\"\n\t,\":bicyclist:\"\n\t,\":horse_racing:\"\n\t,\":snowboarder:\"\n\t,\":swimmer:\"\n\t,\":surfer:\"\n\t,\":ski:\"\n\t,\":spades:\"\n\t,\":hearts:\"\n\t,\":clubs:\"\n\t,\":diamonds:\"\n\t,\":gem:\"\n\t,\":ring:\"\n\t,\":trophy:\"\n\t,\":musical_score:\"\n\t,\":musical_keyboard:\"\n\t,\":violin:\"\n\t,\":space_invader:\"\n\t,\":video_game:\"\n\t,\":black_joker:\"\n\t,\":flower_playing_cards:\"\n\t,\":game_die:\"\n\t,\":dart:\"\n\t,\":mahjong:\"\n\t,\":clapper:\"\n\t,\":memo:\"\n\t,\":pencil:\"\n\t,\":book:\"\n\t,\":art:\"\n\t,\":microphone:\"\n\t,\":headphones:\"\n\t,\":trumpet:\"\n\t,\":saxophone:\"\n\t,\":guitar:\"\n\t,\":shoe:\"\n\t,\":sandal:\"\n\t,\":high_heel:\"\n\t,\":lipstick:\"\n\t,\":boot:\"\n\t,\":shirt:\"\n\t,\":tshirt:\"\n\t,\":necktie:\"\n\t,\":womans_clothes:\"\n\t,\":dress:\"\n\t,\":running_shirt_with_sash:\"\n\t,\":jeans:\"\n\t,\":kimono:\"\n\t,\":bikini:\"\n\t,\":ribbon:\"\n\t,\":tophat:\"\n\t,\":crown:\"\n\t,\":womans_hat:\"\n\t,\":mans_shoe:\"\n\t,\":closed_umbrella:\"\n\t,\":briefcase:\"\n\t,\":handbag:\"\n\t,\":pouch:\"\n\t,\":purse:\"\n\t,\":eyeglasses:\"\n\t,\":fishing_pole_and_fish:\"\n\t,\":coffee:\"\n\t,\":tea:\"\n\t,\":sake:\"\n\t,\":baby_bottle:\"\n\t,\":beer:\"\n\t,\":beers:\"\n\t,\":cocktail:\"\n\t,\":tropical_drink:\"\n\t,\":wine_glass:\"\n\t,\":fork_and_knife:\"\n\t,\":pizza:\"\n\t,\":hamburger:\"\n\t,\":fries:\"\n\t,\":poultry_leg:\"\n\t,\":meat_on_bone:\"\n\t,\":spaghetti:\"\n\t,\":curry:\"\n\t,\":fried_shrimp:\"\n\t,\":bento:\"\n\t,\":sushi:\"\n\t,\":fish_cake:\"\n\t,\":rice_ball:\"\n\t,\":rice_cracker:\"\n\t,\":rice:\"\n\t,\":ramen:\"\n\t,\":stew:\"\n\t,\":oden:\"\n\t,\":dango:\"\n\t,\":egg:\"\n\t,\":bread:\"\n\t,\":doughnut:\"\n\t,\":custard:\"\n\t,\":icecream:\"\n\t,\":ice_cream:\"\n\t,\":shaved_ice:\"\n\t,\":birthday:\"\n\t,\":cake:\"\n\t,\":cookie:\"\n\t,\":chocolate_bar:\"\n\t,\":candy:\"\n\t,\":lollipop:\"\n\t,\":honey_pot:\"\n\t,\":apple:\"\n\t,\":green_apple:\"\n\t,\":tangerine:\"\n\t,\":lemon:\"\n\t,\":cherries:\"\n\t,\":grapes:\"\n\t,\":watermelon:\"\n\t,\":strawberry:\"\n\t,\":peach:\"\n\t,\":melon:\"\n\t,\":banana:\"\n\t,\":pear:\"\n\t,\":pineapple:\"\n\t,\":sweet_potato:\"\n\t,\":eggplant:\"\n\t,\":tomato:\"\n\t,\":corn:\"\n\t,\":house:\"\n\t,\":house_with_garden:\"\n\t,\":school:\"\n\t,\":office:\"\n\t,\":post_office:\"\n\t,\":hospital:\"\n\t,\":bank:\"\n\t,\":convenience_store:\"\n\t,\":love_hotel:\"\n\t,\":hotel:\"\n\t,\":wedding:\"\n\t,\":church:\"\n\t,\":department_store:\"\n\t,\":european_post_office:\"\n\t,\":city_sunrise:\"\n\t,\":city_sunset:\"\n\t,\":japanese_castle:\"\n\t,\":european_castle:\"\n\t,\":tent:\"\n\t,\":factory:\"\n\t,\":tokyo_tower:\"\n\t,\":japan:\"\n\t,\":mount_fuji:\"\n\t,\":sunrise_over_mountains:\"\n\t,\":sunrise:\"\n\t,\":stars:\"\n\t,\":statue_of_liberty:\"\n\t,\":bridge_at_night:\"\n\t,\":carousel_horse:\"\n\t,\":rainbow:\"\n\t,\":ferris_wheel:\"\n\t,\":fountain:\"\n\t,\":roller_coaster:\"\n\t,\":ship:\"\n\t,\":speedboat:\"\n\t,\":boat:\"\n\t,\":sailboat:\"\n\t,\":rowboat:\"\n\t,\":anchor:\"\n\t,\":rocket:\"\n\t,\":airplane:\"\n\t,\":helicopter:\"\n\t,\":steam_locomotive:\"\n\t,\":tram:\"\n\t,\":mountain_railway:\"\n\t,\":bike:\"\n\t,\":aerial_tramway:\"\n\t,\":suspension_railway:\"\n\t,\":mountain_cableway:\"\n\t,\":tractor:\"\n\t,\":blue_car:\"\n\t,\":oncoming_automobile:\"\n\t,\":car:\"\n\t,\":red_car:\"\n\t,\":taxi:\"\n\t,\":oncoming_taxi:\"\n\t,\":articulated_lorry:\"\n\t,\":bus:\"\n\t,\":oncoming_bus:\"\n\t,\":rotating_light:\"\n\t,\":police_car:\"\n\t,\":oncoming_police_car:\"\n\t,\":fire_engine:\"\n\t,\":ambulance:\"\n\t,\":minibus:\"\n\t,\":truck:\"\n\t,\":train:\"\n\t,\":station:\"\n\t,\":train2:\"\n\t,\":bullettrain_front:\"\n\t,\":bullettrain_side:\"\n\t,\":light_rail:\"\n\t,\":monorail:\"\n\t,\":railway_car:\"\n\t,\":trolleybus:\"\n\t,\":ticket:\"\n\t,\":fuelpump:\"\n\t,\":vertical_traffic_light:\"\n\t,\":traffic_light:\"\n\t,\":warning:\"\n\t,\":construction:\"\n\t,\":beginner:\"\n\t,\":atm:\"\n\t,\":slot_machine:\"\n\t,\":busstop:\"\n\t,\":barber:\"\n\t,\":hotsprings:\"\n\t,\":checkered_flag:\"\n\t,\":crossed_flags:\"\n\t,\":izakaya_lantern:\"\n\t,\":moyai:\"\n\t,\":circus_tent:\"\n\t,\":performing_arts:\"\n\t,\":round_pushpin:\"\n\t,\":triangular_flag_on_post:\"\n\t,\":jp:\"\n\t,\":kr:\"\n\t,\":cn:\"\n\t,\":us:\"\n\t,\":fr:\"\n\t,\":es:\"\n\t,\":it:\"\n\t,\":ru:\"\n\t,\":gb:\"\n\t,\":uk:\"\n\t,\":de:\"\n\t,\":one:\"\n\t,\":two:\"\n\t,\":three:\"\n\t,\":four:\"\n\t,\":five:\"\n\t,\":six:\"\n\t,\":seven:\"\n\t,\":eight:\"\n\t,\":nine:\"\n\t,\":keycap_ten:\"\n\t,\":1234:\"\n\t,\":zero:\"\n\t,\":hash:\"\n\t,\":symbols:\"\n\t,\":arrow_backward:\"\n\t,\":arrow_down:\"\n\t,\":arrow_forward:\"\n\t,\":arrow_left:\"\n\t,\":capital_abcd:\"\n\t,\":abcd:\"\n\t,\":abc:\"\n\t,\":arrow_lower_left:\"\n\t,\":arrow_lower_right:\"\n\t,\":arrow_right:\"\n\t,\":arrow_up:\"\n\t,\":arrow_upper_left:\"\n\t,\":arrow_upper_right:\"\n\t,\":arrow_double_down:\"\n\t,\":arrow_double_up:\"\n\t,\":arrow_down_small:\"\n\t,\":arrow_heading_down:\"\n\t,\":arrow_heading_up:\"\n\t,\":leftwards_arrow_with_hook:\"\n\t,\":arrow_right_hook:\"\n\t,\":left_right_arrow:\"\n\t,\":arrow_up_down:\"\n\t,\":arrow_up_small:\"\n\t,\":arrows_clockwise:\"\n\t,\":arrows_counterclockwise:\"\n\t,\":rewind:\"\n\t,\":fast_forward:\"\n\t,\":information_source:\"\n\t,\":ok:\"\n\t,\":twisted_rightwards_arrows:\"\n\t,\":repeat:\"\n\t,\":repeat_one:\"\n\t,\":new:\"\n\t,\":top:\"\n\t,\":up:\"\n\t,\":cool:\"\n\t,\":free:\"\n\t,\":ng:\"\n\t,\":cinema:\"\n\t,\":koko:\"\n\t,\":signal_strength:\"\n\t,\":u5272:\"\n\t,\":u5408:\"\n\t,\":u55b6:\"\n\t,\":u6307:\"\n\t,\":u6708:\"\n\t,\":u6709:\"\n\t,\":u6e80:\"\n\t,\":u7121:\"\n\t,\":u7533:\"\n\t,\":u7a7a:\"\n\t,\":u7981:\"\n\t,\":sa:\"\n\t,\":restroom:\"\n\t,\":mens:\"\n\t,\":womens:\"\n\t,\":baby_symbol:\"\n\t,\":no_smoking:\"\n\t,\":parking:\"\n\t,\":wheelchair:\"\n\t,\":metro:\"\n\t,\":baggage_claim:\"\n\t,\":accept:\"\n\t,\":wc:\"\n\t,\":potable_water:\"\n\t,\":put_litter_in_its_place:\"\n\t,\":secret:\"\n\t,\":congratulations:\"\n\t,\":m:\"\n\t,\":passport_control:\"\n\t,\":left_luggage:\"\n\t,\":customs:\"\n\t,\":ideograph_advantage:\"\n\t,\":cl:\"\n\t,\":sos:\"\n\t,\":id:\"\n\t,\":no_entry_sign:\"\n\t,\":underage:\"\n\t,\":no_mobile_phones:\"\n\t,\":do_not_litter:\"\n\t,\":non-potable_water:\"\n\t,\":no_bicycles:\"\n\t,\":no_pedestrians:\"\n\t,\":children_crossing:\"\n\t,\":no_entry:\"\n\t,\":eight_spoked_asterisk:\"\n\t,\":eight_pointed_black_star:\"\n\t,\":heart_decoration:\"\n\t,\":vs:\"\n\t,\":vibration_mode:\"\n\t,\":mobile_phone_off:\"\n\t,\":chart:\"\n\t,\":currency_exchange:\"\n\t,\":aries:\"\n\t,\":taurus:\"\n\t,\":gemini:\"\n\t,\":cancer:\"\n\t,\":leo:\"\n\t,\":virgo:\"\n\t,\":libra:\"\n\t,\":scorpius:\"\n\t,\":sagittarius:\"\n\t,\":capricorn:\"\n\t,\":aquarius:\"\n\t,\":pisces:\"\n\t,\":ophiuchus:\"\n\t,\":six_pointed_star:\"\n\t,\":negative_squared_cross_mark:\"\n\t,\":a:\"\n\t,\":b:\"\n\t,\":ab:\"\n\t,\":o2:\"\n\t,\":diamond_shape_with_a_dot_inside:\"\n\t,\":recycle:\"\n\t,\":end:\"\n\t,\":on:\"\n\t,\":soon:\"\n\t,\":clock1:\"\n\t,\":clock130:\"\n\t,\":clock10:\"\n\t,\":clock1030:\"\n\t,\":clock11:\"\n\t,\":clock1130:\"\n\t,\":clock12:\"\n\t,\":clock1230:\"\n\t,\":clock2:\"\n\t,\":clock230:\"\n\t,\":clock3:\"\n\t,\":clock330:\"\n\t,\":clock4:\"\n\t,\":clock430:\"\n\t,\":clock5:\"\n\t,\":clock530:\"\n\t,\":clock6:\"\n\t,\":clock630:\"\n\t,\":clock7:\"\n\t,\":clock730:\"\n\t,\":clock8:\"\n\t,\":clock830:\"\n\t,\":clock9:\"\n\t,\":clock930:\"\n\t,\":heavy_dollar_sign:\"\n\t,\":copyright:\"\n\t,\":registered:\"\n\t,\":tm:\"\n\t,\":x:\"\n\t,\":heavy_exclamation_mark:\"\n\t,\":bangbang:\"\n\t,\":interrobang:\"\n\t,\":o:\"\n\t,\":heavy_multiplication_x:\"\n\t,\":heavy_plus_sign:\"\n\t,\":heavy_minus_sign:\"\n\t,\":heavy_division_sign:\"\n\t,\":white_flower:\"\n\t,\":100:\"\n\t,\":heavy_check_mark:\"\n\t,\":ballot_box_with_check:\"\n\t,\":radio_button:\"\n\t,\":link:\"\n\t,\":curly_loop:\"\n\t,\":wavy_dash:\"\n\t,\":part_alternation_mark:\"\n\t,\":trident:\"\n\t,\":black_square:\"\n\t,\":white_square:\"\n\t,\":white_check_mark:\"\n\t,\":black_square_button:\"\n\t,\":white_square_button:\"\n\t,\":black_circle:\"\n\t,\":white_circle:\"\n\t,\":red_circle:\"\n\t,\":large_blue_circle:\"\n\t,\":large_blue_diamond:\"\n\t,\":large_orange_diamond:\"\n\t,\":small_blue_diamond:\"\n\t,\":small_orange_diamond:\"\n\t,\":small_red_triangle:\"\n\t,\":small_red_triangle_down:\"\n\t,\":shipit:\"\n]\n\nfunction emojer () {\n\tindex = Math.floor(Math.random()*emojis.length)\n\treturn emojis[index]\n}\n\nmodule.exports = emojer\n",
              "type": "blob"
            },
            "pixie": {
              "path": "pixie",
              "content": "module.exports = {\"version\":\"0.2.0\"};",
              "type": "blob"
            }
          },
          "progenitor": {
            "url": "http://strd6.github.io/editor/"
          },
          "version": "0.2.0",
          "entryPoint": "main",
          "repository": {
            "id": 12983847,
            "name": "emojer",
            "full_name": "STRd6/emojer",
            "owner": {
              "login": "STRd6",
              "id": 18894,
              "avatar_url": "https://0.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
              "gravatar_id": "33117162fff8a9cf50544a604f60c045",
              "url": "https://api.github.com/users/STRd6",
              "html_url": "https://github.com/STRd6",
              "followers_url": "https://api.github.com/users/STRd6/followers",
              "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
              "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
              "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
              "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
              "organizations_url": "https://api.github.com/users/STRd6/orgs",
              "repos_url": "https://api.github.com/users/STRd6/repos",
              "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
              "received_events_url": "https://api.github.com/users/STRd6/received_events",
              "type": "User",
              "site_admin": false
            },
            "private": false,
            "html_url": "https://github.com/STRd6/emojer",
            "description": "Randomly returns a Github emoji",
            "fork": true,
            "url": "https://api.github.com/repos/STRd6/emojer",
            "forks_url": "https://api.github.com/repos/STRd6/emojer/forks",
            "keys_url": "https://api.github.com/repos/STRd6/emojer/keys{/key_id}",
            "collaborators_url": "https://api.github.com/repos/STRd6/emojer/collaborators{/collaborator}",
            "teams_url": "https://api.github.com/repos/STRd6/emojer/teams",
            "hooks_url": "https://api.github.com/repos/STRd6/emojer/hooks",
            "issue_events_url": "https://api.github.com/repos/STRd6/emojer/issues/events{/number}",
            "events_url": "https://api.github.com/repos/STRd6/emojer/events",
            "assignees_url": "https://api.github.com/repos/STRd6/emojer/assignees{/user}",
            "branches_url": "https://api.github.com/repos/STRd6/emojer/branches{/branch}",
            "tags_url": "https://api.github.com/repos/STRd6/emojer/tags",
            "blobs_url": "https://api.github.com/repos/STRd6/emojer/git/blobs{/sha}",
            "git_tags_url": "https://api.github.com/repos/STRd6/emojer/git/tags{/sha}",
            "git_refs_url": "https://api.github.com/repos/STRd6/emojer/git/refs{/sha}",
            "trees_url": "https://api.github.com/repos/STRd6/emojer/git/trees{/sha}",
            "statuses_url": "https://api.github.com/repos/STRd6/emojer/statuses/{sha}",
            "languages_url": "https://api.github.com/repos/STRd6/emojer/languages",
            "stargazers_url": "https://api.github.com/repos/STRd6/emojer/stargazers",
            "contributors_url": "https://api.github.com/repos/STRd6/emojer/contributors",
            "subscribers_url": "https://api.github.com/repos/STRd6/emojer/subscribers",
            "subscription_url": "https://api.github.com/repos/STRd6/emojer/subscription",
            "commits_url": "https://api.github.com/repos/STRd6/emojer/commits{/sha}",
            "git_commits_url": "https://api.github.com/repos/STRd6/emojer/git/commits{/sha}",
            "comments_url": "https://api.github.com/repos/STRd6/emojer/comments{/number}",
            "issue_comment_url": "https://api.github.com/repos/STRd6/emojer/issues/comments/{number}",
            "contents_url": "https://api.github.com/repos/STRd6/emojer/contents/{+path}",
            "compare_url": "https://api.github.com/repos/STRd6/emojer/compare/{base}...{head}",
            "merges_url": "https://api.github.com/repos/STRd6/emojer/merges",
            "archive_url": "https://api.github.com/repos/STRd6/emojer/{archive_format}{/ref}",
            "downloads_url": "https://api.github.com/repos/STRd6/emojer/downloads",
            "issues_url": "https://api.github.com/repos/STRd6/emojer/issues{/number}",
            "pulls_url": "https://api.github.com/repos/STRd6/emojer/pulls{/number}",
            "milestones_url": "https://api.github.com/repos/STRd6/emojer/milestones{/number}",
            "notifications_url": "https://api.github.com/repos/STRd6/emojer/notifications{?since,all,participating}",
            "labels_url": "https://api.github.com/repos/STRd6/emojer/labels{/name}",
            "releases_url": "https://api.github.com/repos/STRd6/emojer/releases{/id}",
            "created_at": "2013-09-20T21:06:32Z",
            "updated_at": "2013-09-20T21:09:44Z",
            "pushed_at": "2013-09-20T21:09:43Z",
            "git_url": "git://github.com/STRd6/emojer.git",
            "ssh_url": "git@github.com:STRd6/emojer.git",
            "clone_url": "https://github.com/STRd6/emojer.git",
            "svn_url": "https://github.com/STRd6/emojer",
            "homepage": null,
            "size": 175,
            "stargazers_count": 0,
            "watchers_count": 0,
            "language": "JavaScript",
            "has_issues": false,
            "has_downloads": true,
            "has_wiki": true,
            "forks_count": 0,
            "mirror_url": null,
            "open_issues_count": 0,
            "forks": 0,
            "open_issues": 0,
            "watchers": 0,
            "default_branch": "master",
            "master_branch": "master",
            "permissions": {
              "admin": true,
              "push": true,
              "pull": true
            },
            "parent": {
              "id": 12936780,
              "name": "emojer",
              "full_name": "CanastaNasty/emojer",
              "owner": {
                "login": "CanastaNasty",
                "id": 1432520,
                "avatar_url": "https://2.gravatar.com/avatar/0568dac9cff14cb947d2094a92e08f97?d=https%3A%2F%2Fidenticons.github.com%2Fc171966c9f88c386124ebd4c23604f44.png&r=x",
                "gravatar_id": "0568dac9cff14cb947d2094a92e08f97",
                "url": "https://api.github.com/users/CanastaNasty",
                "html_url": "https://github.com/CanastaNasty",
                "followers_url": "https://api.github.com/users/CanastaNasty/followers",
                "following_url": "https://api.github.com/users/CanastaNasty/following{/other_user}",
                "gists_url": "https://api.github.com/users/CanastaNasty/gists{/gist_id}",
                "starred_url": "https://api.github.com/users/CanastaNasty/starred{/owner}{/repo}",
                "subscriptions_url": "https://api.github.com/users/CanastaNasty/subscriptions",
                "organizations_url": "https://api.github.com/users/CanastaNasty/orgs",
                "repos_url": "https://api.github.com/users/CanastaNasty/repos",
                "events_url": "https://api.github.com/users/CanastaNasty/events{/privacy}",
                "received_events_url": "https://api.github.com/users/CanastaNasty/received_events",
                "type": "User",
                "site_admin": false
              },
              "private": false,
              "html_url": "https://github.com/CanastaNasty/emojer",
              "description": "Randomly returns a Github emoji",
              "fork": false,
              "url": "https://api.github.com/repos/CanastaNasty/emojer",
              "forks_url": "https://api.github.com/repos/CanastaNasty/emojer/forks",
              "keys_url": "https://api.github.com/repos/CanastaNasty/emojer/keys{/key_id}",
              "collaborators_url": "https://api.github.com/repos/CanastaNasty/emojer/collaborators{/collaborator}",
              "teams_url": "https://api.github.com/repos/CanastaNasty/emojer/teams",
              "hooks_url": "https://api.github.com/repos/CanastaNasty/emojer/hooks",
              "issue_events_url": "https://api.github.com/repos/CanastaNasty/emojer/issues/events{/number}",
              "events_url": "https://api.github.com/repos/CanastaNasty/emojer/events",
              "assignees_url": "https://api.github.com/repos/CanastaNasty/emojer/assignees{/user}",
              "branches_url": "https://api.github.com/repos/CanastaNasty/emojer/branches{/branch}",
              "tags_url": "https://api.github.com/repos/CanastaNasty/emojer/tags",
              "blobs_url": "https://api.github.com/repos/CanastaNasty/emojer/git/blobs{/sha}",
              "git_tags_url": "https://api.github.com/repos/CanastaNasty/emojer/git/tags{/sha}",
              "git_refs_url": "https://api.github.com/repos/CanastaNasty/emojer/git/refs{/sha}",
              "trees_url": "https://api.github.com/repos/CanastaNasty/emojer/git/trees{/sha}",
              "statuses_url": "https://api.github.com/repos/CanastaNasty/emojer/statuses/{sha}",
              "languages_url": "https://api.github.com/repos/CanastaNasty/emojer/languages",
              "stargazers_url": "https://api.github.com/repos/CanastaNasty/emojer/stargazers",
              "contributors_url": "https://api.github.com/repos/CanastaNasty/emojer/contributors",
              "subscribers_url": "https://api.github.com/repos/CanastaNasty/emojer/subscribers",
              "subscription_url": "https://api.github.com/repos/CanastaNasty/emojer/subscription",
              "commits_url": "https://api.github.com/repos/CanastaNasty/emojer/commits{/sha}",
              "git_commits_url": "https://api.github.com/repos/CanastaNasty/emojer/git/commits{/sha}",
              "comments_url": "https://api.github.com/repos/CanastaNasty/emojer/comments{/number}",
              "issue_comment_url": "https://api.github.com/repos/CanastaNasty/emojer/issues/comments/{number}",
              "contents_url": "https://api.github.com/repos/CanastaNasty/emojer/contents/{+path}",
              "compare_url": "https://api.github.com/repos/CanastaNasty/emojer/compare/{base}...{head}",
              "merges_url": "https://api.github.com/repos/CanastaNasty/emojer/merges",
              "archive_url": "https://api.github.com/repos/CanastaNasty/emojer/{archive_format}{/ref}",
              "downloads_url": "https://api.github.com/repos/CanastaNasty/emojer/downloads",
              "issues_url": "https://api.github.com/repos/CanastaNasty/emojer/issues{/number}",
              "pulls_url": "https://api.github.com/repos/CanastaNasty/emojer/pulls{/number}",
              "milestones_url": "https://api.github.com/repos/CanastaNasty/emojer/milestones{/number}",
              "notifications_url": "https://api.github.com/repos/CanastaNasty/emojer/notifications{?since,all,participating}",
              "labels_url": "https://api.github.com/repos/CanastaNasty/emojer/labels{/name}",
              "releases_url": "https://api.github.com/repos/CanastaNasty/emojer/releases{/id}",
              "created_at": "2013-09-18T23:17:00Z",
              "updated_at": "2013-09-20T21:06:32Z",
              "pushed_at": "2013-09-19T00:22:07Z",
              "git_url": "git://github.com/CanastaNasty/emojer.git",
              "ssh_url": "git@github.com:CanastaNasty/emojer.git",
              "clone_url": "https://github.com/CanastaNasty/emojer.git",
              "svn_url": "https://github.com/CanastaNasty/emojer",
              "homepage": null,
              "size": 252,
              "stargazers_count": 0,
              "watchers_count": 0,
              "language": "JavaScript",
              "has_issues": true,
              "has_downloads": true,
              "has_wiki": true,
              "forks_count": 1,
              "mirror_url": null,
              "open_issues_count": 0,
              "forks": 1,
              "open_issues": 0,
              "watchers": 0,
              "default_branch": "master",
              "master_branch": "master"
            },
            "source": {
              "id": 12936780,
              "name": "emojer",
              "full_name": "CanastaNasty/emojer",
              "owner": {
                "login": "CanastaNasty",
                "id": 1432520,
                "avatar_url": "https://2.gravatar.com/avatar/0568dac9cff14cb947d2094a92e08f97?d=https%3A%2F%2Fidenticons.github.com%2Fc171966c9f88c386124ebd4c23604f44.png&r=x",
                "gravatar_id": "0568dac9cff14cb947d2094a92e08f97",
                "url": "https://api.github.com/users/CanastaNasty",
                "html_url": "https://github.com/CanastaNasty",
                "followers_url": "https://api.github.com/users/CanastaNasty/followers",
                "following_url": "https://api.github.com/users/CanastaNasty/following{/other_user}",
                "gists_url": "https://api.github.com/users/CanastaNasty/gists{/gist_id}",
                "starred_url": "https://api.github.com/users/CanastaNasty/starred{/owner}{/repo}",
                "subscriptions_url": "https://api.github.com/users/CanastaNasty/subscriptions",
                "organizations_url": "https://api.github.com/users/CanastaNasty/orgs",
                "repos_url": "https://api.github.com/users/CanastaNasty/repos",
                "events_url": "https://api.github.com/users/CanastaNasty/events{/privacy}",
                "received_events_url": "https://api.github.com/users/CanastaNasty/received_events",
                "type": "User",
                "site_admin": false
              },
              "private": false,
              "html_url": "https://github.com/CanastaNasty/emojer",
              "description": "Randomly returns a Github emoji",
              "fork": false,
              "url": "https://api.github.com/repos/CanastaNasty/emojer",
              "forks_url": "https://api.github.com/repos/CanastaNasty/emojer/forks",
              "keys_url": "https://api.github.com/repos/CanastaNasty/emojer/keys{/key_id}",
              "collaborators_url": "https://api.github.com/repos/CanastaNasty/emojer/collaborators{/collaborator}",
              "teams_url": "https://api.github.com/repos/CanastaNasty/emojer/teams",
              "hooks_url": "https://api.github.com/repos/CanastaNasty/emojer/hooks",
              "issue_events_url": "https://api.github.com/repos/CanastaNasty/emojer/issues/events{/number}",
              "events_url": "https://api.github.com/repos/CanastaNasty/emojer/events",
              "assignees_url": "https://api.github.com/repos/CanastaNasty/emojer/assignees{/user}",
              "branches_url": "https://api.github.com/repos/CanastaNasty/emojer/branches{/branch}",
              "tags_url": "https://api.github.com/repos/CanastaNasty/emojer/tags",
              "blobs_url": "https://api.github.com/repos/CanastaNasty/emojer/git/blobs{/sha}",
              "git_tags_url": "https://api.github.com/repos/CanastaNasty/emojer/git/tags{/sha}",
              "git_refs_url": "https://api.github.com/repos/CanastaNasty/emojer/git/refs{/sha}",
              "trees_url": "https://api.github.com/repos/CanastaNasty/emojer/git/trees{/sha}",
              "statuses_url": "https://api.github.com/repos/CanastaNasty/emojer/statuses/{sha}",
              "languages_url": "https://api.github.com/repos/CanastaNasty/emojer/languages",
              "stargazers_url": "https://api.github.com/repos/CanastaNasty/emojer/stargazers",
              "contributors_url": "https://api.github.com/repos/CanastaNasty/emojer/contributors",
              "subscribers_url": "https://api.github.com/repos/CanastaNasty/emojer/subscribers",
              "subscription_url": "https://api.github.com/repos/CanastaNasty/emojer/subscription",
              "commits_url": "https://api.github.com/repos/CanastaNasty/emojer/commits{/sha}",
              "git_commits_url": "https://api.github.com/repos/CanastaNasty/emojer/git/commits{/sha}",
              "comments_url": "https://api.github.com/repos/CanastaNasty/emojer/comments{/number}",
              "issue_comment_url": "https://api.github.com/repos/CanastaNasty/emojer/issues/comments/{number}",
              "contents_url": "https://api.github.com/repos/CanastaNasty/emojer/contents/{+path}",
              "compare_url": "https://api.github.com/repos/CanastaNasty/emojer/compare/{base}...{head}",
              "merges_url": "https://api.github.com/repos/CanastaNasty/emojer/merges",
              "archive_url": "https://api.github.com/repos/CanastaNasty/emojer/{archive_format}{/ref}",
              "downloads_url": "https://api.github.com/repos/CanastaNasty/emojer/downloads",
              "issues_url": "https://api.github.com/repos/CanastaNasty/emojer/issues{/number}",
              "pulls_url": "https://api.github.com/repos/CanastaNasty/emojer/pulls{/number}",
              "milestones_url": "https://api.github.com/repos/CanastaNasty/emojer/milestones{/number}",
              "notifications_url": "https://api.github.com/repos/CanastaNasty/emojer/notifications{?since,all,participating}",
              "labels_url": "https://api.github.com/repos/CanastaNasty/emojer/labels{/name}",
              "releases_url": "https://api.github.com/repos/CanastaNasty/emojer/releases{/id}",
              "created_at": "2013-09-18T23:17:00Z",
              "updated_at": "2013-09-20T21:06:32Z",
              "pushed_at": "2013-09-19T00:22:07Z",
              "git_url": "git://github.com/CanastaNasty/emojer.git",
              "ssh_url": "git@github.com:CanastaNasty/emojer.git",
              "clone_url": "https://github.com/CanastaNasty/emojer.git",
              "svn_url": "https://github.com/CanastaNasty/emojer",
              "homepage": null,
              "size": 252,
              "stargazers_count": 0,
              "watchers_count": 0,
              "language": "JavaScript",
              "has_issues": true,
              "has_downloads": true,
              "has_wiki": true,
              "forks_count": 1,
              "mirror_url": null,
              "open_issues_count": 0,
              "forks": 1,
              "open_issues": 0,
              "watchers": 0,
              "default_branch": "master",
              "master_branch": "master"
            },
            "network_count": 1,
            "subscribers_count": 1,
            "branch": "v0.2.0",
            "defaultBranch": "master"
          },
          "dependencies": {},
          "name": "emojer"
        }
      },
      "name": "github"
    },
    "hygiene": {
      "source": {
        "LICENSE": {
          "path": "LICENSE",
          "mode": "100644",
          "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
          "type": "blob"
        },
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "hygiene\n=======\n\nKeeping clean\n",
          "type": "blob"
        },
        "hygiene.coffee.md": {
          "path": "hygiene.coffee.md",
          "mode": "100644",
          "content": "Hygiene\n=======\n\nHygiene keeps our biz clean.\n\nEventually it may expand to perform complex static analysis, but right now it's\njust a bunch of dumb regexes.\n\n    trailingWhitespace = /[ \\t]*$/gm\n    nothing = \"\"\n    newline = \"\\n\"\n\n    ensureTrailingNewline = (content) ->\n      if content.lastIndexOf(newline) != content.length - 1\n        \"#{content}#{newline}\"\n      else\n        content\n\n    module.exports =\n      clean: (content) ->\n        ensureTrailingNewline(\n          content\n          .replace(trailingWhitespace, nothing)\n        )\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "version: \"0.2.0\"\nentryPoint: \"hygiene\"\n",
          "type": "blob"
        },
        "test/hygiene.coffee": {
          "path": "test/hygiene.coffee",
          "mode": "100644",
          "content": "Hygiene = require \"../hygiene\"\n\ndescribe \"cleaning\", ->\n  it \"should remove trailing whitespace\", ->\n    assert.equal Hygiene.clean(\"heyy   \\n\"), \"heyy\\n\"\n\n  it \"should ensure trailing newline\", ->\n    assert.equal Hygiene.clean(\"a\"), \"a\\n\"\n\n  it \"should keep empties empty\", ->\n    assert.equal Hygiene.clean(\"\"), \"\"\n",
          "type": "blob"
        }
      },
      "distribution": {
        "hygiene": {
          "path": "hygiene",
          "content": "(function() {\n  var ensureTrailingNewline, newline, nothing, trailingWhitespace;\n\n  trailingWhitespace = /[ \\t]*$/gm;\n\n  nothing = \"\";\n\n  newline = \"\\n\";\n\n  ensureTrailingNewline = function(content) {\n    if (content.lastIndexOf(newline) !== content.length - 1) {\n      return \"\" + content + newline;\n    } else {\n      return content;\n    }\n  };\n\n  module.exports = {\n    clean: function(content) {\n      return ensureTrailingNewline(content.replace(trailingWhitespace, nothing));\n    }\n  };\n\n}).call(this);\n\n//# sourceURL=hygiene.coffee",
          "type": "blob"
        },
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"version\":\"0.2.0\",\"entryPoint\":\"hygiene\"};",
          "type": "blob"
        },
        "test/hygiene": {
          "path": "test/hygiene",
          "content": "(function() {\n  var Hygiene;\n\n  Hygiene = require(\"../hygiene\");\n\n  describe(\"cleaning\", function() {\n    it(\"should remove trailing whitespace\", function() {\n      return assert.equal(Hygiene.clean(\"heyy   \\n\"), \"heyy\\n\");\n    });\n    it(\"should ensure trailing newline\", function() {\n      return assert.equal(Hygiene.clean(\"a\"), \"a\\n\");\n    });\n    return it(\"should keep empties empty\", function() {\n      return assert.equal(Hygiene.clean(\"\"), \"\");\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/hygiene.coffee",
          "type": "blob"
        }
      },
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "version": "0.2.0",
      "entryPoint": "hygiene",
      "repository": {
        "id": 13007778,
        "name": "hygiene",
        "full_name": "STRd6/hygiene",
        "owner": {
          "login": "STRd6",
          "id": 18894,
          "avatar_url": "https://0.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
          "gravatar_id": "33117162fff8a9cf50544a604f60c045",
          "url": "https://api.github.com/users/STRd6",
          "html_url": "https://github.com/STRd6",
          "followers_url": "https://api.github.com/users/STRd6/followers",
          "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
          "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
          "organizations_url": "https://api.github.com/users/STRd6/orgs",
          "repos_url": "https://api.github.com/users/STRd6/repos",
          "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
          "received_events_url": "https://api.github.com/users/STRd6/received_events",
          "type": "User",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/STRd6/hygiene",
        "description": "Keeping clean",
        "fork": false,
        "url": "https://api.github.com/repos/STRd6/hygiene",
        "forks_url": "https://api.github.com/repos/STRd6/hygiene/forks",
        "keys_url": "https://api.github.com/repos/STRd6/hygiene/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/STRd6/hygiene/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/STRd6/hygiene/teams",
        "hooks_url": "https://api.github.com/repos/STRd6/hygiene/hooks",
        "issue_events_url": "https://api.github.com/repos/STRd6/hygiene/issues/events{/number}",
        "events_url": "https://api.github.com/repos/STRd6/hygiene/events",
        "assignees_url": "https://api.github.com/repos/STRd6/hygiene/assignees{/user}",
        "branches_url": "https://api.github.com/repos/STRd6/hygiene/branches{/branch}",
        "tags_url": "https://api.github.com/repos/STRd6/hygiene/tags",
        "blobs_url": "https://api.github.com/repos/STRd6/hygiene/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/STRd6/hygiene/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/STRd6/hygiene/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/STRd6/hygiene/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/STRd6/hygiene/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/STRd6/hygiene/languages",
        "stargazers_url": "https://api.github.com/repos/STRd6/hygiene/stargazers",
        "contributors_url": "https://api.github.com/repos/STRd6/hygiene/contributors",
        "subscribers_url": "https://api.github.com/repos/STRd6/hygiene/subscribers",
        "subscription_url": "https://api.github.com/repos/STRd6/hygiene/subscription",
        "commits_url": "https://api.github.com/repos/STRd6/hygiene/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/STRd6/hygiene/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/STRd6/hygiene/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/STRd6/hygiene/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/STRd6/hygiene/contents/{+path}",
        "compare_url": "https://api.github.com/repos/STRd6/hygiene/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/STRd6/hygiene/merges",
        "archive_url": "https://api.github.com/repos/STRd6/hygiene/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/STRd6/hygiene/downloads",
        "issues_url": "https://api.github.com/repos/STRd6/hygiene/issues{/number}",
        "pulls_url": "https://api.github.com/repos/STRd6/hygiene/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/STRd6/hygiene/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/STRd6/hygiene/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/STRd6/hygiene/labels{/name}",
        "releases_url": "https://api.github.com/repos/STRd6/hygiene/releases{/id}",
        "created_at": "2013-09-22T04:41:53Z",
        "updated_at": "2013-09-29T22:09:24Z",
        "pushed_at": "2013-09-29T22:09:23Z",
        "git_url": "git://github.com/STRd6/hygiene.git",
        "ssh_url": "git@github.com:STRd6/hygiene.git",
        "clone_url": "https://github.com/STRd6/hygiene.git",
        "svn_url": "https://github.com/STRd6/hygiene",
        "homepage": null,
        "size": 428,
        "stargazers_count": 0,
        "watchers_count": 0,
        "language": "CoffeeScript",
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "default_branch": "master",
        "master_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "network_count": 0,
        "subscribers_count": 1,
        "branch": "v0.2.0",
        "defaultBranch": "master"
      },
      "dependencies": {},
      "name": "hygiene"
    },
    "runtime": {
      "source": {
        "LICENSE": {
          "path": "LICENSE",
          "mode": "100644",
          "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
          "type": "blob"
        },
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "runtime\n=======\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "version: \"0.3.0\"\nentryPoint: \"runtime\"\ndependencies:\n  appcache: \"distri/appcache:v0.2.0\"\n",
          "type": "blob"
        },
        "runtime.coffee.md": {
          "path": "runtime.coffee.md",
          "mode": "100644",
          "content": "Runtime\n=======\n\n    require \"appcache\"\n\nThe runtime holds utilities to assist with an apps running environment.\n\n    module.exports = (pkg) ->\n\nCall on start to boot up the runtime, get the root node, add styles, display a\npromo. Link back to the creator of this app in the promo.\n\n      self =\n        boot: ->\n          if pkg?.progenitor?.url\n            promo(\"You should meet my creator #{pkg.progenitor.url}\")\n\n          promo(\"Docs #{document.location.href}docs\")\n\n          return self\n\nApply the stylesheet to the root node.\n\n        applyStyleSheet: (style, className=\"runtime\") ->\n          styleNode = document.createElement(\"style\")\n          styleNode.innerHTML = style\n          styleNode.className = className\n\n          if previousStyleNode = document.head.querySelector(\"style.#{className}\")\n            previousStyleNode.parentNode.removeChild(prevousStyleNode)\n\n          document.head.appendChild(styleNode)\n\n          return self\n\nHelpers\n-------\n\nDisplay a promo in the console.\n\n    promo = (message) ->\n      console.log(\"%c #{message}\", \"\"\"\n        background: #000;\n        color: white;\n        font-size: 2em;\n        line-height: 2em;\n        padding: 10px 100px;\n        margin-bottom: 1em;\n        text-shadow:\n          0 0 0.05em #fff,\n          0 0 0.1em #fff,\n          0 0 0.15em #fff,\n          0 0 0.2em #ff00de,\n          0 0 0.35em #ff00de,\n          0 0 0.4em #ff00de,\n          0 0 0.5em #ff00de,\n          0 0 0.75em #ff00de;'\n      \"\"\")\n",
          "type": "blob"
        },
        "test/runtime.coffee": {
          "path": "test/runtime.coffee",
          "mode": "100644",
          "content": "Runtime = require \"../runtime\"\n\ndescribe \"Runtime\", ->\n  it \"should be created from a package and provide a boot method\", ->\n    assert Runtime(PACKAGE).boot()\n\n  it \"should be able to attach a style\", ->\n    assert Runtime().applyStyleSheet(\"body {background-color: lightgrey}\")\n\n  it \"should work without a package\", ->\n    assert Runtime().boot()\n",
          "type": "blob"
        }
      },
      "distribution": {
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"version\":\"0.3.0\",\"entryPoint\":\"runtime\",\"dependencies\":{\"appcache\":\"distri/appcache:v0.2.0\"}};",
          "type": "blob"
        },
        "runtime": {
          "path": "runtime",
          "content": "(function() {\n  var promo;\n\n  require(\"appcache\");\n\n  module.exports = function(pkg) {\n    var self;\n    return self = {\n      boot: function() {\n        var _ref;\n        if (pkg != null ? (_ref = pkg.progenitor) != null ? _ref.url : void 0 : void 0) {\n          promo(\"You should meet my creator \" + pkg.progenitor.url);\n        }\n        promo(\"Docs \" + document.location.href + \"docs\");\n        return self;\n      },\n      applyStyleSheet: function(style, className) {\n        var previousStyleNode, styleNode;\n        if (className == null) {\n          className = \"runtime\";\n        }\n        styleNode = document.createElement(\"style\");\n        styleNode.innerHTML = style;\n        styleNode.className = className;\n        if (previousStyleNode = document.head.querySelector(\"style.\" + className)) {\n          previousStyleNode.parentNode.removeChild(prevousStyleNode);\n        }\n        document.head.appendChild(styleNode);\n        return self;\n      }\n    };\n  };\n\n  promo = function(message) {\n    return console.log(\"%c \" + message, \"background: #000;\\ncolor: white;\\nfont-size: 2em;\\nline-height: 2em;\\npadding: 10px 100px;\\nmargin-bottom: 1em;\\ntext-shadow:\\n  0 0 0.05em #fff,\\n  0 0 0.1em #fff,\\n  0 0 0.15em #fff,\\n  0 0 0.2em #ff00de,\\n  0 0 0.35em #ff00de,\\n  0 0 0.4em #ff00de,\\n  0 0 0.5em #ff00de,\\n  0 0 0.75em #ff00de;'\");\n  };\n\n}).call(this);\n\n//# sourceURL=runtime.coffee",
          "type": "blob"
        },
        "test/runtime": {
          "path": "test/runtime",
          "content": "(function() {\n  var Runtime;\n\n  Runtime = require(\"../runtime\");\n\n  describe(\"Runtime\", function() {\n    it(\"should be created from a package and provide a boot method\", function() {\n      return assert(Runtime(PACKAGE).boot());\n    });\n    it(\"should be able to attach a style\", function() {\n      return assert(Runtime().applyStyleSheet(\"body {background-color: lightgrey}\"));\n    });\n    return it(\"should work without a package\", function() {\n      return assert(Runtime().boot());\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/runtime.coffee",
          "type": "blob"
        }
      },
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "version": "0.3.0",
      "entryPoint": "runtime",
      "repository": {
        "id": 13202878,
        "name": "runtime",
        "full_name": "distri/runtime",
        "owner": {
          "login": "distri",
          "id": 6005125,
          "avatar_url": "https://avatars.githubusercontent.com/u/6005125",
          "gravatar_id": null,
          "url": "https://api.github.com/users/distri",
          "html_url": "https://github.com/distri",
          "followers_url": "https://api.github.com/users/distri/followers",
          "following_url": "https://api.github.com/users/distri/following{/other_user}",
          "gists_url": "https://api.github.com/users/distri/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/distri/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/distri/subscriptions",
          "organizations_url": "https://api.github.com/users/distri/orgs",
          "repos_url": "https://api.github.com/users/distri/repos",
          "events_url": "https://api.github.com/users/distri/events{/privacy}",
          "received_events_url": "https://api.github.com/users/distri/received_events",
          "type": "Organization",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/distri/runtime",
        "description": "",
        "fork": false,
        "url": "https://api.github.com/repos/distri/runtime",
        "forks_url": "https://api.github.com/repos/distri/runtime/forks",
        "keys_url": "https://api.github.com/repos/distri/runtime/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/distri/runtime/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/distri/runtime/teams",
        "hooks_url": "https://api.github.com/repos/distri/runtime/hooks",
        "issue_events_url": "https://api.github.com/repos/distri/runtime/issues/events{/number}",
        "events_url": "https://api.github.com/repos/distri/runtime/events",
        "assignees_url": "https://api.github.com/repos/distri/runtime/assignees{/user}",
        "branches_url": "https://api.github.com/repos/distri/runtime/branches{/branch}",
        "tags_url": "https://api.github.com/repos/distri/runtime/tags",
        "blobs_url": "https://api.github.com/repos/distri/runtime/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/distri/runtime/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/distri/runtime/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/distri/runtime/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/distri/runtime/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/distri/runtime/languages",
        "stargazers_url": "https://api.github.com/repos/distri/runtime/stargazers",
        "contributors_url": "https://api.github.com/repos/distri/runtime/contributors",
        "subscribers_url": "https://api.github.com/repos/distri/runtime/subscribers",
        "subscription_url": "https://api.github.com/repos/distri/runtime/subscription",
        "commits_url": "https://api.github.com/repos/distri/runtime/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/distri/runtime/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/distri/runtime/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/distri/runtime/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/distri/runtime/contents/{+path}",
        "compare_url": "https://api.github.com/repos/distri/runtime/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/distri/runtime/merges",
        "archive_url": "https://api.github.com/repos/distri/runtime/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/distri/runtime/downloads",
        "issues_url": "https://api.github.com/repos/distri/runtime/issues{/number}",
        "pulls_url": "https://api.github.com/repos/distri/runtime/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/distri/runtime/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/distri/runtime/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/distri/runtime/labels{/name}",
        "releases_url": "https://api.github.com/repos/distri/runtime/releases{/id}",
        "created_at": "2013-09-30T00:44:37Z",
        "updated_at": "2014-02-27T19:26:02Z",
        "pushed_at": "2013-11-29T20:14:49Z",
        "git_url": "git://github.com/distri/runtime.git",
        "ssh_url": "git@github.com:distri/runtime.git",
        "clone_url": "https://github.com/distri/runtime.git",
        "svn_url": "https://github.com/distri/runtime",
        "homepage": null,
        "size": 140,
        "stargazers_count": 0,
        "watchers_count": 0,
        "language": "CoffeeScript",
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "default_branch": "master",
        "master_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "organization": {
          "login": "distri",
          "id": 6005125,
          "avatar_url": "https://avatars.githubusercontent.com/u/6005125",
          "gravatar_id": null,
          "url": "https://api.github.com/users/distri",
          "html_url": "https://github.com/distri",
          "followers_url": "https://api.github.com/users/distri/followers",
          "following_url": "https://api.github.com/users/distri/following{/other_user}",
          "gists_url": "https://api.github.com/users/distri/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/distri/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/distri/subscriptions",
          "organizations_url": "https://api.github.com/users/distri/orgs",
          "repos_url": "https://api.github.com/users/distri/repos",
          "events_url": "https://api.github.com/users/distri/events{/privacy}",
          "received_events_url": "https://api.github.com/users/distri/received_events",
          "type": "Organization",
          "site_admin": false
        },
        "network_count": 0,
        "subscribers_count": 1,
        "branch": "v0.3.0",
        "defaultBranch": "master"
      },
      "dependencies": {
        "appcache": {
          "source": {
            "LICENSE": {
              "path": "LICENSE",
              "mode": "100644",
              "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
              "type": "blob"
            },
            "README.md": {
              "path": "README.md",
              "mode": "100644",
              "content": "appcache\n========\n\nHTML5 AppCache Helpers\n",
              "type": "blob"
            },
            "main.coffee.md": {
              "path": "main.coffee.md",
              "mode": "100644",
              "content": "App Cache\n=========\n\nSome helpers for working with HTML5 application cache.\n\nhttp://www.html5rocks.com/en/tutorials/appcache/beginner/\n\n    applicationCache = window.applicationCache\n\n    applicationCache.addEventListener 'updateready', (e) ->\n      if applicationCache.status is applicationCache.UPDATEREADY\n        # Browser downloaded a new app cache.\n        if confirm('A new version of this site is available. Load it?')\n          window.location.reload()\n    , false\n",
              "type": "blob"
            },
            "pixie.cson": {
              "path": "pixie.cson",
              "mode": "100644",
              "content": "version: \"0.2.0\"\nentryPoint: \"main\"\n",
              "type": "blob"
            }
          },
          "distribution": {
            "main": {
              "path": "main",
              "content": "(function() {\n  var applicationCache;\n\n  applicationCache = window.applicationCache;\n\n  applicationCache.addEventListener('updateready', function(e) {\n    if (applicationCache.status === applicationCache.UPDATEREADY) {\n      if (confirm('A new version of this site is available. Load it?')) {\n        return window.location.reload();\n      }\n    }\n  }, false);\n\n}).call(this);\n\n//# sourceURL=main.coffee",
              "type": "blob"
            },
            "pixie": {
              "path": "pixie",
              "content": "module.exports = {\"version\":\"0.2.0\",\"entryPoint\":\"main\"};",
              "type": "blob"
            }
          },
          "progenitor": {
            "url": "http://strd6.github.io/editor/"
          },
          "version": "0.2.0",
          "entryPoint": "main",
          "repository": {
            "id": 14539483,
            "name": "appcache",
            "full_name": "distri/appcache",
            "owner": {
              "login": "distri",
              "id": 6005125,
              "avatar_url": "https://identicons.github.com/f90c81ffc1498e260c820082f2e7ca5f.png",
              "gravatar_id": null,
              "url": "https://api.github.com/users/distri",
              "html_url": "https://github.com/distri",
              "followers_url": "https://api.github.com/users/distri/followers",
              "following_url": "https://api.github.com/users/distri/following{/other_user}",
              "gists_url": "https://api.github.com/users/distri/gists{/gist_id}",
              "starred_url": "https://api.github.com/users/distri/starred{/owner}{/repo}",
              "subscriptions_url": "https://api.github.com/users/distri/subscriptions",
              "organizations_url": "https://api.github.com/users/distri/orgs",
              "repos_url": "https://api.github.com/users/distri/repos",
              "events_url": "https://api.github.com/users/distri/events{/privacy}",
              "received_events_url": "https://api.github.com/users/distri/received_events",
              "type": "Organization",
              "site_admin": false
            },
            "private": false,
            "html_url": "https://github.com/distri/appcache",
            "description": "HTML5 AppCache Helpers",
            "fork": false,
            "url": "https://api.github.com/repos/distri/appcache",
            "forks_url": "https://api.github.com/repos/distri/appcache/forks",
            "keys_url": "https://api.github.com/repos/distri/appcache/keys{/key_id}",
            "collaborators_url": "https://api.github.com/repos/distri/appcache/collaborators{/collaborator}",
            "teams_url": "https://api.github.com/repos/distri/appcache/teams",
            "hooks_url": "https://api.github.com/repos/distri/appcache/hooks",
            "issue_events_url": "https://api.github.com/repos/distri/appcache/issues/events{/number}",
            "events_url": "https://api.github.com/repos/distri/appcache/events",
            "assignees_url": "https://api.github.com/repos/distri/appcache/assignees{/user}",
            "branches_url": "https://api.github.com/repos/distri/appcache/branches{/branch}",
            "tags_url": "https://api.github.com/repos/distri/appcache/tags",
            "blobs_url": "https://api.github.com/repos/distri/appcache/git/blobs{/sha}",
            "git_tags_url": "https://api.github.com/repos/distri/appcache/git/tags{/sha}",
            "git_refs_url": "https://api.github.com/repos/distri/appcache/git/refs{/sha}",
            "trees_url": "https://api.github.com/repos/distri/appcache/git/trees{/sha}",
            "statuses_url": "https://api.github.com/repos/distri/appcache/statuses/{sha}",
            "languages_url": "https://api.github.com/repos/distri/appcache/languages",
            "stargazers_url": "https://api.github.com/repos/distri/appcache/stargazers",
            "contributors_url": "https://api.github.com/repos/distri/appcache/contributors",
            "subscribers_url": "https://api.github.com/repos/distri/appcache/subscribers",
            "subscription_url": "https://api.github.com/repos/distri/appcache/subscription",
            "commits_url": "https://api.github.com/repos/distri/appcache/commits{/sha}",
            "git_commits_url": "https://api.github.com/repos/distri/appcache/git/commits{/sha}",
            "comments_url": "https://api.github.com/repos/distri/appcache/comments{/number}",
            "issue_comment_url": "https://api.github.com/repos/distri/appcache/issues/comments/{number}",
            "contents_url": "https://api.github.com/repos/distri/appcache/contents/{+path}",
            "compare_url": "https://api.github.com/repos/distri/appcache/compare/{base}...{head}",
            "merges_url": "https://api.github.com/repos/distri/appcache/merges",
            "archive_url": "https://api.github.com/repos/distri/appcache/{archive_format}{/ref}",
            "downloads_url": "https://api.github.com/repos/distri/appcache/downloads",
            "issues_url": "https://api.github.com/repos/distri/appcache/issues{/number}",
            "pulls_url": "https://api.github.com/repos/distri/appcache/pulls{/number}",
            "milestones_url": "https://api.github.com/repos/distri/appcache/milestones{/number}",
            "notifications_url": "https://api.github.com/repos/distri/appcache/notifications{?since,all,participating}",
            "labels_url": "https://api.github.com/repos/distri/appcache/labels{/name}",
            "releases_url": "https://api.github.com/repos/distri/appcache/releases{/id}",
            "created_at": "2013-11-19T22:09:16Z",
            "updated_at": "2013-11-29T20:49:51Z",
            "pushed_at": "2013-11-19T22:10:28Z",
            "git_url": "git://github.com/distri/appcache.git",
            "ssh_url": "git@github.com:distri/appcache.git",
            "clone_url": "https://github.com/distri/appcache.git",
            "svn_url": "https://github.com/distri/appcache",
            "homepage": null,
            "size": 240,
            "stargazers_count": 0,
            "watchers_count": 0,
            "language": "CoffeeScript",
            "has_issues": true,
            "has_downloads": true,
            "has_wiki": true,
            "forks_count": 0,
            "mirror_url": null,
            "open_issues_count": 0,
            "forks": 0,
            "open_issues": 0,
            "watchers": 0,
            "default_branch": "master",
            "master_branch": "master",
            "permissions": {
              "admin": true,
              "push": true,
              "pull": true
            },
            "organization": {
              "login": "distri",
              "id": 6005125,
              "avatar_url": "https://identicons.github.com/f90c81ffc1498e260c820082f2e7ca5f.png",
              "gravatar_id": null,
              "url": "https://api.github.com/users/distri",
              "html_url": "https://github.com/distri",
              "followers_url": "https://api.github.com/users/distri/followers",
              "following_url": "https://api.github.com/users/distri/following{/other_user}",
              "gists_url": "https://api.github.com/users/distri/gists{/gist_id}",
              "starred_url": "https://api.github.com/users/distri/starred{/owner}{/repo}",
              "subscriptions_url": "https://api.github.com/users/distri/subscriptions",
              "organizations_url": "https://api.github.com/users/distri/orgs",
              "repos_url": "https://api.github.com/users/distri/repos",
              "events_url": "https://api.github.com/users/distri/events{/privacy}",
              "received_events_url": "https://api.github.com/users/distri/received_events",
              "type": "Organization",
              "site_admin": false
            },
            "network_count": 0,
            "subscribers_count": 1,
            "branch": "v0.2.0",
            "defaultBranch": "master"
          },
          "dependencies": {},
          "name": "appcache"
        }
      },
      "name": "runtime"
    },
    "packager": {
      "source": {
        "LICENSE": {
          "path": "LICENSE",
          "mode": "100644",
          "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
          "type": "blob"
        },
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "packager\n========\n\nCreate standalone build products for web packages\n",
          "type": "blob"
        },
        "deferred.coffee.md": {
          "path": "deferred.coffee.md",
          "mode": "100644",
          "content": "Deferred\n========\n\nUse jQuery.Deferred to implement deferreds, but\nstay insulated by not blasting the $ all over our code\nthat doesn't really depend on jQuery\nThis let's us swap our our Deferred provider more easily later.\n\n    global.Deferred = $.Deferred\n\nA helper to return a promise that may be resolved or rejected by the passed\ncode block.\n\n    withDeferrence = (fn) ->\n      deferred = Deferred()\n\n      # TODO: This try catch may be useless from deferring the fn\n      try\n        fn.defer(deferred)\n      catch e\n        deferred.reject(e)\n\n      return deferred.promise()\n\nA deferred encapsulating a confirm dialog.\n\n    Deferred.Confirm = (message) ->\n      withDeferrence (deferred) ->\n        if window.confirm(message)\n          deferred.resolve()\n        else\n          deferred.reject()\n\nA deferred that may present a confirm dialog, but only if a certain condition is\nmet.\n\n    Deferred.ConfirmIf = (flag, message) ->\n      if flag\n        return Deferred.Confirm(message)\n      else\n        withDeferrence (deferred) ->\n          deferred.resolve()\n\nA deferred that encapsulates a conditional execution of a block that returns a\npromise. If the condition is met the promise returning block is executed,\notherwise the deferred is marked as resolved and the block is not executed.\n\n    Deferred.ExecuteIf = (flag, callback) ->\n      withDeferrence (deferred) ->\n        if flag\n          callback().then deferred.resolve\n        else\n          deferred.resolve()\n\nA touched up version of jQuery's `when`. Succeeds if all promises succeed, fails\nif any promise fails. Handles jQuery weirdness if only operating on one promise.\n\nTODO: We should think about the case when there are zero promises. Probably\nsucceed with an empty array for results.\n\n    Deferred.when = (promises) ->\n      $.when.apply(null, promises)\n      .then (results...) ->\n        # WTF: jQuery.when behaves differently for one argument than it does for\n        # two or more.\n\n        if promises.length is 1\n          results = [results]\n        else\n          results\n        \n        return results\n\n    module.exports = Deferred\n",
          "type": "blob"
        },
        "packager.coffee.md": {
          "path": "packager.coffee.md",
          "mode": "100644",
          "content": "Packager\n========\n\nThe main responsibilities of the packager are bundling dependencies, and\ncreating the package.\n\nSpecification\n-------------\n\nA package is a json object with the following properties:\n\n`dependencies` an object whose keys are names of dependencies within our context\nand whose values are packages.\n\n`distribution` an object whose keys are extensionless file paths and whose\nvalues are executable code compiled from the source files that exist at those paths.\n\n`source` an object whose keys are file paths and whose values are source code.\nThe `source` can be loaded and modified in an editor to recreate the compiled\npackage.\n\nIf the environment or dependecies contain all the tools required to build the\npackage then theoretically `distribution` may be omitted as it can be recreated\nfrom `source`.\n\nFor a \"production\" distribution `source` may be omitted, but that will greatly\nlimit adaptability of packages.\n\nThe package specification is closely tied to the `require` method. This allows\nus to use a simplified Node.js style `require` from the browser.\n\n[Require Docs](/require/docs)\n\nImplementation\n--------------\n\n    Deferred = require \"./deferred\"\n\n    Packager =\n\nIf our string is an absolute URL then we assume that the server is CORS enabled\nand we can make a cross origin request to collect the JSON data.\n\nWe also handle a Github repo dependency. Something like `STRd6/issues:master`.\nThis uses JSONP to load the package from the gh-pages branch of the given repo.\n\n`STRd6/issues:master` will be accessible at `http://strd6.github.io/issues/master.jsonp`.\nThe callback is the same as the repo info string: `window[\"STRd6/issues:master\"](... DATA ...)`\n\nWhy all the madness? Github pages doesn't allow CORS right now, so we need to use\nthe JSONP hack to work around it. Because the files are static we can't allow the\nserver to generate a wrapper in response to our query string param so we need to\nwork out a unique one per file ahead of time. The `<user>/<repo>:<ref>` string is\nunique for all our packages so we use it to determine the URL and name callback.\n\n      collectDependencies: (dependencies, cachedDependencies={}) ->\n        names = Object.keys(dependencies)\n\n        Deferred.when(names.map (name) ->\n          value = dependencies[name]\n\n          if typeof value is \"string\"\n            if startsWith(value, \"http\")\n              $.getJSON(value)\n            else\n              if (match = value.match(/([^\\/]*)\\/([^\\:]*)\\:(.*)/))\n                [callback, user, repo, branch] = match\n\n                if cachedDependency = lookupCached(cachedDependencies, \"#{user}/#{repo}\", branch)\n                  # DOUBLE HACK: Because jQuery deferreds are so bad\n                  # we only need to make this an array if our length isn't exactly one\n                  if names.length is 1\n                    cachedDependency\n                  else\n                    [cachedDependency]\n                else\n                  url = \"http://#{user}.github.io/#{repo}/#{branch}.json.js\"\n                  console.log \"ajaxin\", url\n                  \n                  $.ajax\n                    url: url\n                    dataType: \"jsonp\"\n                    jsonpCallback: callback\n                    cache: true\n              else\n                reject \"\"\"\n                  Failed to parse repository info string #{value}, be sure it's in the\n                  form `<user>/<repo>:<ref>` for example: `STRd6/issues:master`\n                  or `STRd6/editor:v0.9.1`\n                \"\"\"\n          else\n            reject \"Can only handle url string dependencies right now\"\n        ).then (results) ->\n          bundledDependencies = {}\n\n          names.each (name, i) ->\n            bundledDependencies[name] = results[i][0]\n\n          return bundledDependencies\n\nCreate the standalone components of this package. An html page that loads the\nmain entry point for demonstration purposes and a json package that can be\nused as a dependency in other packages.\n\nThe html page is named `index.html` and is in the folder of the ref, or the root\nif our ref is the default branch.\n\nDocs are generated and placed in `docs` directory as a sibling to `index.html`.\n\nAn application manifest is served up as a sibling to `index.html` as well.\n\nThe `.json.js` build product is placed into the root level, as siblings to the\nfolder containing `index.html`. If this branch is the default then these build\nproducts are placed as siblings to `index.html`\n\nThe optional second argument is an array of files to be added to the final\npackage.\n\n      standAlone: (pkg, files=[]) ->\n        repository = pkg.repository\n        branch = repository.branch\n\n        if branch is repository.default_branch\n          base = \"\"\n        else\n          base = \"#{branch}/\"\n\n        add = (path, content) ->\n          files.push\n            content: content\n            mode: \"100644\"\n            path: path\n            type: \"blob\"\n\n        add \"#{base}index.html\", html(pkg)\n        add \"#{base}manifest.appcache\", cacheManifest(pkg)\n\n        json = JSON.stringify(pkg, null, 2)\n\n        add \"#{branch}.json.js\", jsonpWrapper(repository, json)\n\n        return files\n\nGenerates a standalone page for testing the app.\n\n      testScripts: (pkg) ->\n        {distribution} = pkg\n\n        testProgram = Object.keys(distribution).filter (path) ->\n          path.match /test\\//\n        .map (testPath) ->\n          \"require('./#{testPath}')\"\n        .join \"\\n\"\n\n        \"\"\"\n          #{dependencyScripts(pkg.remoteDependencies)}\n          <script>\n            #{packageWrapper(pkg, testProgram)}\n          <\\/script>\n        \"\"\"\n\n    module.exports = Packager\n\nHelpers\n-------\n\n    startsWith = (string, prefix) ->\n      string.match RegExp \"^#{prefix}\"\n\nCreate a rejected deferred with the given message.\n\n    reject = (message) ->\n      Deferred().reject(message)\n\nA standalone html page for a package.\n\n    html = (pkg) ->\n      \"\"\"\n        <!DOCTYPE html>\n        <html manifest=\"manifest.appcache?#{+new Date}\">\n        <head>\n        <meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\" />\n        #{dependencyScripts(pkg.remoteDependencies)}\n        </head>\n        <body>\n        <script>\n        #{packageWrapper(pkg, \"require('./#{pkg.entryPoint}')\")}\n        <\\/script>\n        </body>\n        </html>\n      \"\"\"\n\nAn HTML5 cache manifest for a package.\n\n    cacheManifest = (pkg) ->\n      \"\"\"\n        CACHE MANIFEST\n        # #{+ new Date}\n\n        CACHE:\n        index.html\n        #{(pkg.remoteDependencies or []).join(\"\\n\")}\n\n        NETWORK:\n        https://*\n        http://*\n        *\n      \"\"\"\n\n`makeScript` returns a string representation of a script tag that has a src\nattribute.\n\n    makeScript = (src) ->\n      \"<script src=#{JSON.stringify(src)}><\\/script>\"\n\n`dependencyScripts` returns a string containing the script tags that are\nthe remote script dependencies of this build.\n\n    dependencyScripts = (remoteDependencies=[]) ->\n      remoteDependencies.map(makeScript).join(\"\\n\")\n\nWraps the given data in a JSONP function wrapper. This allows us to host our\npackages on Github pages and get around any same origin issues by using JSONP.\n\n    jsonpWrapper = (repository, data) ->\n      \"\"\"\n        window[\"#{repository.full_name}:#{repository.branch}\"](#{data});\n      \"\"\"\n\nWrap code in a closure that provides the package and a require function. This\ncan be used for generating standalone HTML pages, scripts, and tests.\n\n    packageWrapper = (pkg, code) ->\n      \"\"\"\n        ;(function(PACKAGE) {\n        var oldRequire = window.Require;\n        #{PACKAGE.dependencies.require.distribution.main.content}\n        var require = Require.generateFor(PACKAGE);\n        window.Require = oldRequire;\n        #{code}\n        })(#{JSON.stringify(pkg, null, 2)});\n      \"\"\"\n\nLookup a package from a cached list of packages.\n\n    lookupCached = (cache, fullName, branch) ->\n      names = Object.keys(cache).filter (key) ->\n        repository = cache[key].repository\n\n        repository.full_name is fullName and repository.branch is branch\n\n      if names?[0]\n        cache[name]\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "version: \"0.5.2\"\nentryPoint: \"packager\"\nremoteDependencies: [\n  \"https://code.jquery.com/jquery-1.10.1.min.js\"\n]\ndependencies:\n  require: \"STRd6/require:v0.3.0\"\n",
          "type": "blob"
        },
        "test/deferred.coffee": {
          "path": "test/deferred.coffee",
          "mode": "100644",
          "content": "Deferred = require \"../deferred\"\n\ndescribe \"Deferred\", ->\n  describe \"when with multi-arg duders\", ->\n    it \"should work on an array of one\", (done) ->\n      deferred = Deferred()\n\n      Deferred.when([\n        deferred.promise()\n      ]).then (results) ->\n        console.log results\n        assert.equal results.length, 1, \"Results length should be 1\"\n\n        assert.equal results[0][0], \"result\", \"First result should be 'result'\"\n\n        done()\n\n      deferred.resolve(\"result\", \"wat\")\n\n    it \"should work on an array of more than one\", (done) ->\n      deferred1 = Deferred()\n      deferred2 = Deferred()\n\n      Deferred.when([\n        deferred1.promise()\n        deferred2.promise()\n      ]).then (results) ->\n        assert.equal results.length, 2\n\n        assert.equal results[0][0], \"result1\"\n        assert.equal results[1][0], \"result2\"\n\n        done()\n\n      deferred1.resolve(\"result1\", \"wat\")\n      deferred2.resolve(\"result2\", \"wat\")\n\n    it \"should work on an array of zero\", (done) ->\n      Deferred.when([]).then (results) ->\n        assert.equal results.length, 0\n\n        done()\n\n  describe \"when with single arg duders\", ->\n    it \"should work on an array of one\", (done) ->\n      deferred = Deferred()\n\n      Deferred.when([\n        deferred.promise()\n      ]).then (results) ->\n        console.log results\n        assert.equal results.length, 1, \"Results length should be 1\"\n\n        assert.equal results[0], \"result\", \"result should be 'result'\"\n\n        done()\n\n      deferred.resolve(\"result\")\n\n    it \"should work on an array of more than one\", (done) ->\n      deferred1 = Deferred()\n      deferred2 = Deferred()\n\n      Deferred.when([\n        deferred1.promise()\n        deferred2.promise()\n      ]).then (results) ->\n        assert.equal results.length, 2\n\n        assert.equal results[0], \"result1\"\n        assert.equal results[1], \"result2\"\n\n        done()\n\n      deferred1.resolve(\"result1\")\n      deferred2.resolve(\"result2\")\n",
          "type": "blob"
        },
        "test/packager.coffee": {
          "path": "test/packager.coffee",
          "mode": "100644",
          "content": "Packager = require(\"../packager\")\n\n{dependencies} = require(\"../pixie\")\n\ndescribe \"Packager\", ->\n  it \"should exist\", ->\n    assert Packager\n\n  it \"should be able to create a standalone html page\", ->\n    assert Packager.standAlone(PACKAGE)\n\n  it \"should be able to collect remote dependencies\", ->\n    Packager.collectDependencies(dependencies)\n    .then (results) ->\n      console.log \"success\"\n      console.log results\n    , (errors) ->\n      console.log errors\n",
          "type": "blob"
        }
      },
      "distribution": {
        "deferred": {
          "path": "deferred",
          "content": "(function() {\n  var withDeferrence,\n    __slice = [].slice;\n\n  global.Deferred = $.Deferred;\n\n  withDeferrence = function(fn) {\n    var deferred, e;\n    deferred = Deferred();\n    try {\n      fn.defer(deferred);\n    } catch (_error) {\n      e = _error;\n      deferred.reject(e);\n    }\n    return deferred.promise();\n  };\n\n  Deferred.Confirm = function(message) {\n    return withDeferrence(function(deferred) {\n      if (window.confirm(message)) {\n        return deferred.resolve();\n      } else {\n        return deferred.reject();\n      }\n    });\n  };\n\n  Deferred.ConfirmIf = function(flag, message) {\n    if (flag) {\n      return Deferred.Confirm(message);\n    } else {\n      return withDeferrence(function(deferred) {\n        return deferred.resolve();\n      });\n    }\n  };\n\n  Deferred.ExecuteIf = function(flag, callback) {\n    return withDeferrence(function(deferred) {\n      if (flag) {\n        return callback().then(deferred.resolve);\n      } else {\n        return deferred.resolve();\n      }\n    });\n  };\n\n  Deferred.when = function(promises) {\n    return $.when.apply(null, promises).then(function() {\n      var results;\n      results = 1 <= arguments.length ? __slice.call(arguments, 0) : [];\n      if (promises.length === 1) {\n        results = [results];\n      } else {\n        results;\n      }\n      return results;\n    });\n  };\n\n  module.exports = Deferred;\n\n}).call(this);\n\n//# sourceURL=deferred.coffee",
          "type": "blob"
        },
        "packager": {
          "path": "packager",
          "content": "(function() {\n  var Deferred, Packager, cacheManifest, dependencyScripts, html, jsonpWrapper, lookupCached, makeScript, packageWrapper, reject, startsWith;\n\n  Deferred = require(\"./deferred\");\n\n  Packager = {\n    collectDependencies: function(dependencies, cachedDependencies) {\n      var names;\n      if (cachedDependencies == null) {\n        cachedDependencies = {};\n      }\n      names = Object.keys(dependencies);\n      return Deferred.when(names.map(function(name) {\n        var branch, cachedDependency, callback, match, repo, url, user, value;\n        value = dependencies[name];\n        if (typeof value === \"string\") {\n          if (startsWith(value, \"http\")) {\n            return $.getJSON(value);\n          } else {\n            if ((match = value.match(/([^\\/]*)\\/([^\\:]*)\\:(.*)/))) {\n              callback = match[0], user = match[1], repo = match[2], branch = match[3];\n              if (cachedDependency = lookupCached(cachedDependencies, \"\" + user + \"/\" + repo, branch)) {\n                if (names.length === 1) {\n                  return cachedDependency;\n                } else {\n                  return [cachedDependency];\n                }\n              } else {\n                url = \"http://\" + user + \".github.io/\" + repo + \"/\" + branch + \".json.js\";\n                console.log(\"ajaxin\", url);\n                return $.ajax({\n                  url: url,\n                  dataType: \"jsonp\",\n                  jsonpCallback: callback,\n                  cache: true\n                });\n              }\n            } else {\n              return reject(\"Failed to parse repository info string \" + value + \", be sure it's in the\\nform `<user>/<repo>:<ref>` for example: `STRd6/issues:master`\\nor `STRd6/editor:v0.9.1`\");\n            }\n          }\n        } else {\n          return reject(\"Can only handle url string dependencies right now\");\n        }\n      })).then(function(results) {\n        var bundledDependencies;\n        bundledDependencies = {};\n        names.each(function(name, i) {\n          return bundledDependencies[name] = results[i][0];\n        });\n        return bundledDependencies;\n      });\n    },\n    standAlone: function(pkg, files) {\n      var add, base, branch, json, repository;\n      if (files == null) {\n        files = [];\n      }\n      repository = pkg.repository;\n      branch = repository.branch;\n      if (branch === repository.default_branch) {\n        base = \"\";\n      } else {\n        base = \"\" + branch + \"/\";\n      }\n      add = function(path, content) {\n        return files.push({\n          content: content,\n          mode: \"100644\",\n          path: path,\n          type: \"blob\"\n        });\n      };\n      add(\"\" + base + \"index.html\", html(pkg));\n      add(\"\" + base + \"manifest.appcache\", cacheManifest(pkg));\n      json = JSON.stringify(pkg, null, 2);\n      add(\"\" + branch + \".json.js\", jsonpWrapper(repository, json));\n      return files;\n    },\n    testScripts: function(pkg) {\n      var distribution, testProgram;\n      distribution = pkg.distribution;\n      testProgram = Object.keys(distribution).filter(function(path) {\n        return path.match(/test\\//);\n      }).map(function(testPath) {\n        return \"require('./\" + testPath + \"')\";\n      }).join(\"\\n\");\n      return \"\" + (dependencyScripts(pkg.remoteDependencies)) + \"\\n<script>\\n  \" + (packageWrapper(pkg, testProgram)) + \"\\n<\\/script>\";\n    }\n  };\n\n  module.exports = Packager;\n\n  startsWith = function(string, prefix) {\n    return string.match(RegExp(\"^\" + prefix));\n  };\n\n  reject = function(message) {\n    return Deferred().reject(message);\n  };\n\n  html = function(pkg) {\n    return \"<!DOCTYPE html>\\n<html manifest=\\\"manifest.appcache?\" + (+(new Date)) + \"\\\">\\n<head>\\n<meta http-equiv=\\\"Content-Type\\\" content=\\\"text/html; charset=UTF-8\\\" />\\n\" + (dependencyScripts(pkg.remoteDependencies)) + \"\\n</head>\\n<body>\\n<script>\\n\" + (packageWrapper(pkg, \"require('./\" + pkg.entryPoint + \"')\")) + \"\\n<\\/script>\\n</body>\\n</html>\";\n  };\n\n  cacheManifest = function(pkg) {\n    return \"CACHE MANIFEST\\n# \" + (+(new Date)) + \"\\n\\nCACHE:\\nindex.html\\n\" + ((pkg.remoteDependencies || []).join(\"\\n\")) + \"\\n\\nNETWORK:\\nhttps://*\\nhttp://*\\n*\";\n  };\n\n  makeScript = function(src) {\n    return \"<script src=\" + (JSON.stringify(src)) + \"><\\/script>\";\n  };\n\n  dependencyScripts = function(remoteDependencies) {\n    if (remoteDependencies == null) {\n      remoteDependencies = [];\n    }\n    return remoteDependencies.map(makeScript).join(\"\\n\");\n  };\n\n  jsonpWrapper = function(repository, data) {\n    return \"window[\\\"\" + repository.full_name + \":\" + repository.branch + \"\\\"](\" + data + \");\";\n  };\n\n  packageWrapper = function(pkg, code) {\n    return \";(function(PACKAGE) {\\nvar oldRequire = window.Require;\\n\" + PACKAGE.dependencies.require.distribution.main.content + \"\\nvar require = Require.generateFor(PACKAGE);\\nwindow.Require = oldRequire;\\n\" + code + \"\\n})(\" + (JSON.stringify(pkg, null, 2)) + \");\";\n  };\n\n  lookupCached = function(cache, fullName, branch) {\n    var names;\n    names = Object.keys(cache).filter(function(key) {\n      var repository;\n      repository = cache[key].repository;\n      return repository.full_name === fullName && repository.branch === branch;\n    });\n    if (names != null ? names[0] : void 0) {\n      return cache[name];\n    }\n  };\n\n}).call(this);\n\n//# sourceURL=packager.coffee",
          "type": "blob"
        },
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"version\":\"0.5.2\",\"entryPoint\":\"packager\",\"remoteDependencies\":[\"https://code.jquery.com/jquery-1.10.1.min.js\"],\"dependencies\":{\"require\":\"STRd6/require:v0.3.0\"}};",
          "type": "blob"
        },
        "test/deferred": {
          "path": "test/deferred",
          "content": "(function() {\n  var Deferred;\n\n  Deferred = require(\"../deferred\");\n\n  describe(\"Deferred\", function() {\n    describe(\"when with multi-arg duders\", function() {\n      it(\"should work on an array of one\", function(done) {\n        var deferred;\n        deferred = Deferred();\n        Deferred.when([deferred.promise()]).then(function(results) {\n          console.log(results);\n          assert.equal(results.length, 1, \"Results length should be 1\");\n          assert.equal(results[0][0], \"result\", \"First result should be 'result'\");\n          return done();\n        });\n        return deferred.resolve(\"result\", \"wat\");\n      });\n      it(\"should work on an array of more than one\", function(done) {\n        var deferred1, deferred2;\n        deferred1 = Deferred();\n        deferred2 = Deferred();\n        Deferred.when([deferred1.promise(), deferred2.promise()]).then(function(results) {\n          assert.equal(results.length, 2);\n          assert.equal(results[0][0], \"result1\");\n          assert.equal(results[1][0], \"result2\");\n          return done();\n        });\n        deferred1.resolve(\"result1\", \"wat\");\n        return deferred2.resolve(\"result2\", \"wat\");\n      });\n      return it(\"should work on an array of zero\", function(done) {\n        return Deferred.when([]).then(function(results) {\n          assert.equal(results.length, 0);\n          return done();\n        });\n      });\n    });\n    return describe(\"when with single arg duders\", function() {\n      it(\"should work on an array of one\", function(done) {\n        var deferred;\n        deferred = Deferred();\n        Deferred.when([deferred.promise()]).then(function(results) {\n          console.log(results);\n          assert.equal(results.length, 1, \"Results length should be 1\");\n          assert.equal(results[0], \"result\", \"result should be 'result'\");\n          return done();\n        });\n        return deferred.resolve(\"result\");\n      });\n      return it(\"should work on an array of more than one\", function(done) {\n        var deferred1, deferred2;\n        deferred1 = Deferred();\n        deferred2 = Deferred();\n        Deferred.when([deferred1.promise(), deferred2.promise()]).then(function(results) {\n          assert.equal(results.length, 2);\n          assert.equal(results[0], \"result1\");\n          assert.equal(results[1], \"result2\");\n          return done();\n        });\n        deferred1.resolve(\"result1\");\n        return deferred2.resolve(\"result2\");\n      });\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/deferred.coffee",
          "type": "blob"
        },
        "test/packager": {
          "path": "test/packager",
          "content": "(function() {\n  var Packager, dependencies;\n\n  Packager = require(\"../packager\");\n\n  dependencies = require(\"../pixie\").dependencies;\n\n  describe(\"Packager\", function() {\n    it(\"should exist\", function() {\n      return assert(Packager);\n    });\n    it(\"should be able to create a standalone html page\", function() {\n      return assert(Packager.standAlone(PACKAGE));\n    });\n    return it(\"should be able to collect remote dependencies\", function() {\n      return Packager.collectDependencies(dependencies).then(function(results) {\n        console.log(\"success\");\n        return console.log(results);\n      }, function(errors) {\n        return console.log(errors);\n      });\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/packager.coffee",
          "type": "blob"
        }
      },
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "version": "0.5.2",
      "entryPoint": "packager",
      "remoteDependencies": [
        "https://code.jquery.com/jquery-1.10.1.min.js"
      ],
      "repository": {
        "id": 13223375,
        "name": "packager",
        "full_name": "distri/packager",
        "owner": {
          "login": "distri",
          "id": 6005125,
          "avatar_url": "https://gravatar.com/avatar/192f3f168409e79c42107f081139d9f3?d=https%3A%2F%2Fidenticons.github.com%2Ff90c81ffc1498e260c820082f2e7ca5f.png&r=x",
          "gravatar_id": "192f3f168409e79c42107f081139d9f3",
          "url": "https://api.github.com/users/distri",
          "html_url": "https://github.com/distri",
          "followers_url": "https://api.github.com/users/distri/followers",
          "following_url": "https://api.github.com/users/distri/following{/other_user}",
          "gists_url": "https://api.github.com/users/distri/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/distri/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/distri/subscriptions",
          "organizations_url": "https://api.github.com/users/distri/orgs",
          "repos_url": "https://api.github.com/users/distri/repos",
          "events_url": "https://api.github.com/users/distri/events{/privacy}",
          "received_events_url": "https://api.github.com/users/distri/received_events",
          "type": "Organization",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/distri/packager",
        "description": "Create standalone build products for web packages",
        "fork": false,
        "url": "https://api.github.com/repos/distri/packager",
        "forks_url": "https://api.github.com/repos/distri/packager/forks",
        "keys_url": "https://api.github.com/repos/distri/packager/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/distri/packager/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/distri/packager/teams",
        "hooks_url": "https://api.github.com/repos/distri/packager/hooks",
        "issue_events_url": "https://api.github.com/repos/distri/packager/issues/events{/number}",
        "events_url": "https://api.github.com/repos/distri/packager/events",
        "assignees_url": "https://api.github.com/repos/distri/packager/assignees{/user}",
        "branches_url": "https://api.github.com/repos/distri/packager/branches{/branch}",
        "tags_url": "https://api.github.com/repos/distri/packager/tags",
        "blobs_url": "https://api.github.com/repos/distri/packager/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/distri/packager/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/distri/packager/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/distri/packager/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/distri/packager/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/distri/packager/languages",
        "stargazers_url": "https://api.github.com/repos/distri/packager/stargazers",
        "contributors_url": "https://api.github.com/repos/distri/packager/contributors",
        "subscribers_url": "https://api.github.com/repos/distri/packager/subscribers",
        "subscription_url": "https://api.github.com/repos/distri/packager/subscription",
        "commits_url": "https://api.github.com/repos/distri/packager/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/distri/packager/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/distri/packager/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/distri/packager/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/distri/packager/contents/{+path}",
        "compare_url": "https://api.github.com/repos/distri/packager/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/distri/packager/merges",
        "archive_url": "https://api.github.com/repos/distri/packager/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/distri/packager/downloads",
        "issues_url": "https://api.github.com/repos/distri/packager/issues{/number}",
        "pulls_url": "https://api.github.com/repos/distri/packager/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/distri/packager/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/distri/packager/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/distri/packager/labels{/name}",
        "releases_url": "https://api.github.com/repos/distri/packager/releases{/id}",
        "created_at": "2013-09-30T18:28:31Z",
        "updated_at": "2014-03-12T23:57:08Z",
        "pushed_at": "2014-03-12T23:55:54Z",
        "git_url": "git://github.com/distri/packager.git",
        "ssh_url": "git@github.com:distri/packager.git",
        "clone_url": "https://github.com/distri/packager.git",
        "svn_url": "https://github.com/distri/packager",
        "homepage": null,
        "size": 540,
        "stargazers_count": 0,
        "watchers_count": 0,
        "language": "CoffeeScript",
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 1,
        "forks": 0,
        "open_issues": 1,
        "watchers": 0,
        "default_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "organization": {
          "login": "distri",
          "id": 6005125,
          "avatar_url": "https://gravatar.com/avatar/192f3f168409e79c42107f081139d9f3?d=https%3A%2F%2Fidenticons.github.com%2Ff90c81ffc1498e260c820082f2e7ca5f.png&r=x",
          "gravatar_id": "192f3f168409e79c42107f081139d9f3",
          "url": "https://api.github.com/users/distri",
          "html_url": "https://github.com/distri",
          "followers_url": "https://api.github.com/users/distri/followers",
          "following_url": "https://api.github.com/users/distri/following{/other_user}",
          "gists_url": "https://api.github.com/users/distri/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/distri/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/distri/subscriptions",
          "organizations_url": "https://api.github.com/users/distri/orgs",
          "repos_url": "https://api.github.com/users/distri/repos",
          "events_url": "https://api.github.com/users/distri/events{/privacy}",
          "received_events_url": "https://api.github.com/users/distri/received_events",
          "type": "Organization",
          "site_admin": false
        },
        "network_count": 0,
        "subscribers_count": 1,
        "branch": "v0.5.2",
        "publishBranch": "gh-pages"
      },
      "dependencies": {
        "require": {
          "source": {
            "LICENSE": {
              "path": "LICENSE",
              "mode": "100644",
              "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
              "type": "blob"
            },
            "README.md": {
              "path": "README.md",
              "mode": "100644",
              "content": "require\n=======\n\nRequire system for self replicating client side apps\n",
              "type": "blob"
            },
            "main.coffee.md": {
              "path": "main.coffee.md",
              "mode": "100644",
              "content": "Require\n=======\n\nA Node.js compatible require implementation for pure client side apps.\n\nEach file is a module. Modules are responsible for exporting an object. Unlike\ntraditional client side JavaScript, Ruby, or other common languages the module\nis not responsible for naming its product in the context of the requirer. This\nmaintains encapsulation because it is impossible from within a module to know\nwhat external name would be correct to prevent errors of composition in all\npossible uses.\n\nDefinitions\n-----------\n\n## Module\n\nA module is a file.\n\n## Package\n\nA package is an aggregation of modules. A package is a json file that lives on\nthe internet.\n\nIt has the following properties:\n\n- distribution An object whose keys are paths an properties are `fileData`\n- entryPoint Path to the primary module that requiring this package will require.\n- dependencies An object whose keys are names and whose values are urls,\n  bundled packages, or package reference objects.\n\nIt may have additional properties such as `source`, `repository`, and `docs`.\n\n## Application\n\nAn application is a package which has an `entryPoint` and may have dependencies.\nAn application's dependencies may have dependencies. Dependencies may be\nbundled with a package or resolved at a separate time.\n\nUses\n----\n\nFrom a module require another module in the same package.\n\n>     require \"./soup\"\n\nRequire a module in the parent directory\n\n>     require \"../nuts\"\n\nRequire a module from the root directory in the same package\n\n>     require \"/silence\"\n\nFrom a module within a package, require a dependent package.\n\n>     require \"console\"\n\nThe dependency will be delcared something like\n\n>     dependencies:\n>       console: \"http://strd6.github.io/console/v1.2.2.json\"\n\nYou may also require an optional module from within another package\n\n>     require \"console/extras\"\n\nImplementation\n--------------\n\nFile separator is '/'\n\n    fileSeparator = '/'\n\nIn the browser `global` is `window`.\n\n    global = window\n\nDefault entry point\n\n    defaultEntryPoint = \"main\"\n\nA sentinal against circular requires.\n\n    circularGuard = {}\n\nA top-level module so that all other modules won't have to be orphans.\n\n    rootModule =\n      path: \"\"\n\nRequire a module given a path within a package. Each file is its own separate\nmodule. An application is composed of packages.\n\n    loadPath = (parentModule, pkg, path) ->\n      if startsWith(path, '/')\n        localPath = []\n      else\n        localPath = parentModule.path.split(fileSeparator)\n\n      normalizedPath = normalizePath(path, localPath)\n\n      cache = cacheFor(pkg)\n\n      if module = cache[normalizedPath]\n        if module is circularGuard\n          throw \"Circular dependency detected when requiring #{normalizedPath}\"\n      else\n        cache[normalizedPath] = circularGuard\n\n        try\n          cache[normalizedPath] = module = loadModule(pkg, normalizedPath)\n        finally\n          delete cache[normalizedPath] if cache[normalizedPath] is circularGuard\n\n      return module.exports\n\nTo normalize the path we convert local paths to a standard form that does not\ncontain an references to current or parent directories.\n\n    normalizePath = (path, base=[]) ->\n      base = base.concat path.split(fileSeparator)\n      result = []\n\nChew up all the pieces into a standardized path.\n\n      while base.length\n        switch piece = base.shift()\n          when \"..\"\n            result.pop()\n          when \"\", \".\"\n            # Skip\n          else\n            result.push(piece)\n\n      return result.join(fileSeparator)\n\n`loadPackage` Loads a module from a package, optionally specifying a path. If a\npath is given the module at that path is loaded, otherwise the `entryPoint`\nspecified in the package is loaded.\n\n    loadPackage = (parentModule, pkg, path) ->\n      path ||= (pkg.entryPoint || defaultEntryPoint)\n\n      loadPath(parentModule, pkg, path)\n\nLoad a file from within a package.\n\n    loadModule = (pkg, path) ->\n      unless (file = pkg.distribution[path])\n        throw \"Could not find file at #{path} in #{pkg.name}\"\n\n      program = file.content\n      dirname = path.split(fileSeparator)[0...-1].join(fileSeparator)\n\n      module =\n        path: dirname\n        exports: {}\n\nThis external context provides some variable that modules have access to.\n\nA `require` function is exposed to modules so they may require other modules.\n\nAdditional properties such as a reference to the global object and some metadata\nare also exposed.\n\n      context =\n        require: generateRequireFn(pkg, module)\n        global: global\n        module: module\n        exports: module.exports\n        PACKAGE: pkg\n        __filename: path\n        __dirname: dirname\n\n      args = Object.keys(context)\n      values = args.map (name) -> context[name]\n\nExecute the program within the module and given context.\n\n      Function(args..., program).apply(module, values)\n\n      return module\n\nHelper to detect if a given path is a package.\n\n    isPackage = (path) ->\n      if !(startsWith(path, fileSeparator) or\n        startsWith(path, \".#{fileSeparator}\") or\n        startsWith(path, \"..#{fileSeparator}\")\n      )\n        path.split(fileSeparator)[0]\n      else\n        false\n\nGenerate a require function for a given module in a package.\n\nIf we are loading a package in another module then we strip out the module part\nof the name and use the `rootModule` rather than the local module we came from.\nThat way our local path won't affect the lookup path in another package.\n\nLoading a module within our package, uses the requiring module as a parent for\nlocal path resolution.\n\n    generateRequireFn = (pkg, module=rootModule) ->\n      (path) ->\n        if otherPackageName = isPackage(path)\n          packagePath = path.replace(otherPackageName, \"\")\n\n          unless otherPackage = pkg.dependencies[otherPackageName]\n            throw \"Package: #{otherPackageName} not found.\"\n\n          otherPackage.name ?= otherPackageName\n\n          loadPackage(rootModule, otherPackage, packagePath)\n        else\n          loadPath(module, pkg, path)\n\nBecause we can't actually `require('require')` we need to export it a little\ndifferently.\n\n    if exports?\n      exports.generateFor = generateRequireFn\n    else\n      global.Require =\n        generateFor: generateRequireFn\n\nNotes\n-----\n\nWe have to use `pkg` because `package` is a reserved word.\n\nNode needs to check file extensions, but because we have a compile step we are\nable to compile all files extensionlessly based only on their path. So while\nNode may need to check for either `path/somefile.js` or `path/somefile.coffee`\nthat will already have been resolved for us and we will only check\n`path/somefile`\n\nFile extensions may come in handy if we want to skip the compile step and\ncompile on the fly at runtime.\n\nCircular dependencies aren't supported and will probably crash.\n\nHelpers\n-------\n\n    startsWith = (string, prefix) ->\n      string.lastIndexOf(prefix, 0) is 0\n\nCreates a cache for modules within a package.\n\n    cacheFor = (pkg) ->\n      return pkg.cache if pkg.cache\n\n      Object.defineProperty pkg, \"cache\",\n        value: {}\n\n      return pkg.cache\n",
              "type": "blob"
            },
            "pixie.cson": {
              "path": "pixie.cson",
              "mode": "100644",
              "content": "version: \"0.3.0\"\n",
              "type": "blob"
            },
            "samples/circular.coffee": {
              "path": "samples/circular.coffee",
              "mode": "100644",
              "content": "# This test file illustrates a circular requirement and should throw an error.\n\nrequire \"./circular\"\n",
              "type": "blob"
            },
            "samples/random.coffee": {
              "path": "samples/random.coffee",
              "mode": "100644",
              "content": "# Returns a random value, used for testing caching\n\nmodule.exports = Math.random()\n",
              "type": "blob"
            },
            "samples/terminal.coffee": {
              "path": "samples/terminal.coffee",
              "mode": "100644",
              "content": "# A test file for requiring a file that has no dependencies. It should succeed.\n\nexports.something = true\n",
              "type": "blob"
            },
            "samples/throws.coffee": {
              "path": "samples/throws.coffee",
              "mode": "100644",
              "content": "# A test file that throws an error.\n\nthrow \"yolo\"\n",
              "type": "blob"
            },
            "test/require.coffee.md": {
              "path": "test/require.coffee.md",
              "mode": "100644",
              "content": "Testing out this crazy require thing\n\n    # Load our latest require code for testing\n    # NOTE: This causes the root for relative requires to be at the root dir, not the test dir\n    latestRequire = require('/main').generateFor(PACKAGE)\n\n    describe \"require\", ->\n      it \"should not exist globally\", ->\n        assert !global.require\n\n      it \"should be able to require a file that exists with a relative path\", ->\n        assert latestRequire('/samples/terminal')\n\n      it \"should get whatever the file exports\", ->\n        assert latestRequire('/samples/terminal').something\n\n      it \"should not get something the file doesn't export\", ->\n        assert !latestRequire('/samples/terminal').something2\n\n      it \"should throw a descriptive error when requring circular dependencies\", ->\n        assert.throws ->\n          latestRequire('/samples/circular')\n        , /circular/i\n\n      it \"should throw a descriptive error when requiring a package that doesn't exist\", ->\n        assert.throws ->\n          latestRequire \"does_not_exist\"\n        , /not found/i\n\n      it \"should throw a descriptive error when requiring a relative path that doesn't exist\", ->\n        assert.throws ->\n          latestRequire \"/does_not_exist\"\n        , /Could not find file/i\n\n      it \"should recover gracefully enough from requiring files that throw errors\", ->\n        assert.throws ->\n          latestRequire \"/samples/throws\"\n\n        assert.throws ->\n          latestRequire \"/samples/throws\"\n        , (err) ->\n          !/circular/i.test err\n\n      it \"should cache modules\", ->\n        result = require(\"/samples/random\")\n\n        assert.equal require(\"/samples/random\"), result\n\n    describe \"module context\", ->\n      it \"should know __dirname\", ->\n        assert.equal \"test\", __dirname\n\n      it \"should know __filename\", ->\n        assert __filename\n\n      it \"should know its package\", ->\n        assert PACKAGE\n",
              "type": "blob"
            }
          },
          "distribution": {
            "main": {
              "path": "main",
              "content": "(function() {\n  var cacheFor, circularGuard, defaultEntryPoint, fileSeparator, generateRequireFn, global, isPackage, loadModule, loadPackage, loadPath, normalizePath, rootModule, startsWith,\n    __slice = [].slice;\n\n  fileSeparator = '/';\n\n  global = window;\n\n  defaultEntryPoint = \"main\";\n\n  circularGuard = {};\n\n  rootModule = {\n    path: \"\"\n  };\n\n  loadPath = function(parentModule, pkg, path) {\n    var cache, localPath, module, normalizedPath;\n    if (startsWith(path, '/')) {\n      localPath = [];\n    } else {\n      localPath = parentModule.path.split(fileSeparator);\n    }\n    normalizedPath = normalizePath(path, localPath);\n    cache = cacheFor(pkg);\n    if (module = cache[normalizedPath]) {\n      if (module === circularGuard) {\n        throw \"Circular dependency detected when requiring \" + normalizedPath;\n      }\n    } else {\n      cache[normalizedPath] = circularGuard;\n      try {\n        cache[normalizedPath] = module = loadModule(pkg, normalizedPath);\n      } finally {\n        if (cache[normalizedPath] === circularGuard) {\n          delete cache[normalizedPath];\n        }\n      }\n    }\n    return module.exports;\n  };\n\n  normalizePath = function(path, base) {\n    var piece, result;\n    if (base == null) {\n      base = [];\n    }\n    base = base.concat(path.split(fileSeparator));\n    result = [];\n    while (base.length) {\n      switch (piece = base.shift()) {\n        case \"..\":\n          result.pop();\n          break;\n        case \"\":\n        case \".\":\n          break;\n        default:\n          result.push(piece);\n      }\n    }\n    return result.join(fileSeparator);\n  };\n\n  loadPackage = function(parentModule, pkg, path) {\n    path || (path = pkg.entryPoint || defaultEntryPoint);\n    return loadPath(parentModule, pkg, path);\n  };\n\n  loadModule = function(pkg, path) {\n    var args, context, dirname, file, module, program, values;\n    if (!(file = pkg.distribution[path])) {\n      throw \"Could not find file at \" + path + \" in \" + pkg.name;\n    }\n    program = file.content;\n    dirname = path.split(fileSeparator).slice(0, -1).join(fileSeparator);\n    module = {\n      path: dirname,\n      exports: {}\n    };\n    context = {\n      require: generateRequireFn(pkg, module),\n      global: global,\n      module: module,\n      exports: module.exports,\n      PACKAGE: pkg,\n      __filename: path,\n      __dirname: dirname\n    };\n    args = Object.keys(context);\n    values = args.map(function(name) {\n      return context[name];\n    });\n    Function.apply(null, __slice.call(args).concat([program])).apply(module, values);\n    return module;\n  };\n\n  isPackage = function(path) {\n    if (!(startsWith(path, fileSeparator) || startsWith(path, \".\" + fileSeparator) || startsWith(path, \"..\" + fileSeparator))) {\n      return path.split(fileSeparator)[0];\n    } else {\n      return false;\n    }\n  };\n\n  generateRequireFn = function(pkg, module) {\n    if (module == null) {\n      module = rootModule;\n    }\n    return function(path) {\n      var otherPackage, otherPackageName, packagePath;\n      if (otherPackageName = isPackage(path)) {\n        packagePath = path.replace(otherPackageName, \"\");\n        if (!(otherPackage = pkg.dependencies[otherPackageName])) {\n          throw \"Package: \" + otherPackageName + \" not found.\";\n        }\n        if (otherPackage.name == null) {\n          otherPackage.name = otherPackageName;\n        }\n        return loadPackage(rootModule, otherPackage, packagePath);\n      } else {\n        return loadPath(module, pkg, path);\n      }\n    };\n  };\n\n  if (typeof exports !== \"undefined\" && exports !== null) {\n    exports.generateFor = generateRequireFn;\n  } else {\n    global.Require = {\n      generateFor: generateRequireFn\n    };\n  }\n\n  startsWith = function(string, prefix) {\n    return string.lastIndexOf(prefix, 0) === 0;\n  };\n\n  cacheFor = function(pkg) {\n    if (pkg.cache) {\n      return pkg.cache;\n    }\n    Object.defineProperty(pkg, \"cache\", {\n      value: {}\n    });\n    return pkg.cache;\n  };\n\n}).call(this);\n\n//# sourceURL=main.coffee",
              "type": "blob"
            },
            "pixie": {
              "path": "pixie",
              "content": "module.exports = {\"version\":\"0.3.0\"};",
              "type": "blob"
            },
            "samples/circular": {
              "path": "samples/circular",
              "content": "(function() {\n  require(\"./circular\");\n\n}).call(this);\n\n//# sourceURL=samples/circular.coffee",
              "type": "blob"
            },
            "samples/random": {
              "path": "samples/random",
              "content": "(function() {\n  module.exports = Math.random();\n\n}).call(this);\n\n//# sourceURL=samples/random.coffee",
              "type": "blob"
            },
            "samples/terminal": {
              "path": "samples/terminal",
              "content": "(function() {\n  exports.something = true;\n\n}).call(this);\n\n//# sourceURL=samples/terminal.coffee",
              "type": "blob"
            },
            "samples/throws": {
              "path": "samples/throws",
              "content": "(function() {\n  throw \"yolo\";\n\n}).call(this);\n\n//# sourceURL=samples/throws.coffee",
              "type": "blob"
            },
            "test/require": {
              "path": "test/require",
              "content": "(function() {\n  var latestRequire;\n\n  latestRequire = require('/main').generateFor(PACKAGE);\n\n  describe(\"require\", function() {\n    it(\"should not exist globally\", function() {\n      return assert(!global.require);\n    });\n    it(\"should be able to require a file that exists with a relative path\", function() {\n      return assert(latestRequire('/samples/terminal'));\n    });\n    it(\"should get whatever the file exports\", function() {\n      return assert(latestRequire('/samples/terminal').something);\n    });\n    it(\"should not get something the file doesn't export\", function() {\n      return assert(!latestRequire('/samples/terminal').something2);\n    });\n    it(\"should throw a descriptive error when requring circular dependencies\", function() {\n      return assert.throws(function() {\n        return latestRequire('/samples/circular');\n      }, /circular/i);\n    });\n    it(\"should throw a descriptive error when requiring a package that doesn't exist\", function() {\n      return assert.throws(function() {\n        return latestRequire(\"does_not_exist\");\n      }, /not found/i);\n    });\n    it(\"should throw a descriptive error when requiring a relative path that doesn't exist\", function() {\n      return assert.throws(function() {\n        return latestRequire(\"/does_not_exist\");\n      }, /Could not find file/i);\n    });\n    it(\"should recover gracefully enough from requiring files that throw errors\", function() {\n      assert.throws(function() {\n        return latestRequire(\"/samples/throws\");\n      });\n      return assert.throws(function() {\n        return latestRequire(\"/samples/throws\");\n      }, function(err) {\n        return !/circular/i.test(err);\n      });\n    });\n    return it(\"should cache modules\", function() {\n      var result;\n      result = require(\"/samples/random\");\n      return assert.equal(require(\"/samples/random\"), result);\n    });\n  });\n\n  describe(\"module context\", function() {\n    it(\"should know __dirname\", function() {\n      return assert.equal(\"test\", __dirname);\n    });\n    it(\"should know __filename\", function() {\n      return assert(__filename);\n    });\n    return it(\"should know its package\", function() {\n      return assert(PACKAGE);\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/require.coffee",
              "type": "blob"
            }
          },
          "progenitor": {
            "url": "http://strd6.github.io/editor/"
          },
          "version": "0.3.0",
          "entryPoint": "main",
          "repository": {
            "id": 12814740,
            "name": "require",
            "full_name": "STRd6/require",
            "owner": {
              "login": "STRd6",
              "id": 18894,
              "avatar_url": "https://0.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
              "gravatar_id": "33117162fff8a9cf50544a604f60c045",
              "url": "https://api.github.com/users/STRd6",
              "html_url": "https://github.com/STRd6",
              "followers_url": "https://api.github.com/users/STRd6/followers",
              "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
              "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
              "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
              "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
              "organizations_url": "https://api.github.com/users/STRd6/orgs",
              "repos_url": "https://api.github.com/users/STRd6/repos",
              "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
              "received_events_url": "https://api.github.com/users/STRd6/received_events",
              "type": "User",
              "site_admin": false
            },
            "private": false,
            "html_url": "https://github.com/STRd6/require",
            "description": "Require system for self replicating client side apps",
            "fork": false,
            "url": "https://api.github.com/repos/STRd6/require",
            "forks_url": "https://api.github.com/repos/STRd6/require/forks",
            "keys_url": "https://api.github.com/repos/STRd6/require/keys{/key_id}",
            "collaborators_url": "https://api.github.com/repos/STRd6/require/collaborators{/collaborator}",
            "teams_url": "https://api.github.com/repos/STRd6/require/teams",
            "hooks_url": "https://api.github.com/repos/STRd6/require/hooks",
            "issue_events_url": "https://api.github.com/repos/STRd6/require/issues/events{/number}",
            "events_url": "https://api.github.com/repos/STRd6/require/events",
            "assignees_url": "https://api.github.com/repos/STRd6/require/assignees{/user}",
            "branches_url": "https://api.github.com/repos/STRd6/require/branches{/branch}",
            "tags_url": "https://api.github.com/repos/STRd6/require/tags",
            "blobs_url": "https://api.github.com/repos/STRd6/require/git/blobs{/sha}",
            "git_tags_url": "https://api.github.com/repos/STRd6/require/git/tags{/sha}",
            "git_refs_url": "https://api.github.com/repos/STRd6/require/git/refs{/sha}",
            "trees_url": "https://api.github.com/repos/STRd6/require/git/trees{/sha}",
            "statuses_url": "https://api.github.com/repos/STRd6/require/statuses/{sha}",
            "languages_url": "https://api.github.com/repos/STRd6/require/languages",
            "stargazers_url": "https://api.github.com/repos/STRd6/require/stargazers",
            "contributors_url": "https://api.github.com/repos/STRd6/require/contributors",
            "subscribers_url": "https://api.github.com/repos/STRd6/require/subscribers",
            "subscription_url": "https://api.github.com/repos/STRd6/require/subscription",
            "commits_url": "https://api.github.com/repos/STRd6/require/commits{/sha}",
            "git_commits_url": "https://api.github.com/repos/STRd6/require/git/commits{/sha}",
            "comments_url": "https://api.github.com/repos/STRd6/require/comments{/number}",
            "issue_comment_url": "https://api.github.com/repos/STRd6/require/issues/comments/{number}",
            "contents_url": "https://api.github.com/repos/STRd6/require/contents/{+path}",
            "compare_url": "https://api.github.com/repos/STRd6/require/compare/{base}...{head}",
            "merges_url": "https://api.github.com/repos/STRd6/require/merges",
            "archive_url": "https://api.github.com/repos/STRd6/require/{archive_format}{/ref}",
            "downloads_url": "https://api.github.com/repos/STRd6/require/downloads",
            "issues_url": "https://api.github.com/repos/STRd6/require/issues{/number}",
            "pulls_url": "https://api.github.com/repos/STRd6/require/pulls{/number}",
            "milestones_url": "https://api.github.com/repos/STRd6/require/milestones{/number}",
            "notifications_url": "https://api.github.com/repos/STRd6/require/notifications{?since,all,participating}",
            "labels_url": "https://api.github.com/repos/STRd6/require/labels{/name}",
            "releases_url": "https://api.github.com/repos/STRd6/require/releases{/id}",
            "created_at": "2013-09-13T17:00:23Z",
            "updated_at": "2013-10-05T01:34:45Z",
            "pushed_at": "2013-10-05T01:34:43Z",
            "git_url": "git://github.com/STRd6/require.git",
            "ssh_url": "git@github.com:STRd6/require.git",
            "clone_url": "https://github.com/STRd6/require.git",
            "svn_url": "https://github.com/STRd6/require",
            "homepage": null,
            "size": 3636,
            "stargazers_count": 1,
            "watchers_count": 1,
            "language": "CoffeeScript",
            "has_issues": true,
            "has_downloads": true,
            "has_wiki": true,
            "forks_count": 0,
            "mirror_url": null,
            "open_issues_count": 1,
            "forks": 0,
            "open_issues": 1,
            "watchers": 1,
            "default_branch": "master",
            "master_branch": "master",
            "permissions": {
              "admin": true,
              "push": true,
              "pull": true
            },
            "network_count": 0,
            "subscribers_count": 1,
            "branch": "v0.3.0",
            "defaultBranch": "master"
          },
          "dependencies": {}
        }
      }
    },
    "filetree": {
      "source": {
        "LICENSE": {
          "path": "LICENSE",
          "mode": "100644",
          "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
          "type": "blob"
        },
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "filetree\n========\n\nA simple filetree\n",
          "type": "blob"
        },
        "demo.coffee.md": {
          "path": "demo.coffee.md",
          "mode": "100644",
          "content": "A demo application displaying the filetree.\n\n    File = require \"./file\"\n    Filetree = require \"./filetree\"\n\n    template = require(\"./templates/filetree\")\n\n    demoData = [\n      {\n        path: \"hey.yolo\"\n        content: \"wat\"\n        type: \"blob\"\n      }\n    ]\n\n    filetree = Filetree()\n    filetree.load demoData\n\n    filetree.selectedFile.observe (file) ->\n      console.log file\n\n    $('body').append template(filetree)\n",
          "type": "blob"
        },
        "file.coffee.md": {
          "path": "file.coffee.md",
          "mode": "100644",
          "content": "File Model\n==========\n\nThe `File` model represents a file in a file system. It is populated by data\nreturned from the Github API.\n\n    File = (I={}) ->\n      Object.defaults I,\n        content: \"\"\n\n      throw \"File must have a path\" unless I.path\n\n      self = Model(I).observeAll()\n\n      self.extend\n\nThe extension is the last part of the filename after the `.`, for example\n`\"coffee\"` for a file named `\"main.coffee\"` or `\"haml\"` for a file named\n`\"filetree.haml\"`.\n\n        extension: ->\n          self.path().extension()\n\nThe `mode` of the file is what editor mode to use for our text editor.\n\n        mode: ->\n          switch extension = self.extension()\n            when \"js\"\n              \"javascript\"\n            when \"md\" # TODO: See about nested markdown code modes for .haml.md, .js.md, and .coffee.md\n              \"markdown\"\n            when \"cson\"\n              \"coffee\"\n            when \"\"\n              \"text\"\n            else\n              extension\n\nModified tracks whether the file has been changed since it was created.\n\n        modified: Observable(false)\n\nThe `displayName` is how the file appears in views.\n\n        displayName: Observable(self.path())\n\nWhen our content changes we assume we are modified. In the future we may want to\ntrack the original content and compare with that to get a more accurate modified\nstatus.\n\n      self.content.observe ->\n        self.modified(true)\n\nWhen our modified state changes we adjust the `displayName` to provide a visual\nindication.\n\n      self.modified.observe (modified) ->\n        if modified\n          self.displayName(\"*#{self.path()}\")\n        else\n          self.displayName(self.path())\n\n      return self\n\nExport\n\n    module.exports = File\n",
          "type": "blob"
        },
        "filetree.coffee.md": {
          "path": "filetree.coffee.md",
          "mode": "100644",
          "content": "Filetree Model\n==============\n\n    File = require(\"./file\")\n\nThe `Filetree` model represents a tree of files.\n\n    Filetree = (I={}) ->\n      Object.defaults I,\n        files: []\n\n      self = Model(I).observeAll()\n\nThe `selectedFile` observable keeps people up to date on what file has been\nselected.\n\n      self.attrObservable \"selectedFile\"\n\n      self.extend\n\nLoad files either from an array of file data objects or from an object with\npaths as keys and file data objects as values.\n\nThe files are sorted by name after loading.\n\nTODO: Always maintain the files in a sorted list using some kind of sorted\nobservable.\n\n        load: (fileData) ->\n          if Array.isArray(fileData)\n            files = fileData.sort (a, b) ->\n              if a.path < b.path\n                -1\n              else if b.path < a.path\n                1\n              else\n                0\n            .map File\n\n          else\n            files = Object.keys(fileData).sort().map (path) ->\n              File fileData[path]\n\n          self.files(files)\n\nThe `data` method returns an array of file data objects that is compatible with\nthe github tree api.\n\nThe objects have a `path`, `content`, `type`, and `mode`.\n\n        data: ->\n          self.files.map (file) ->\n            path: file.path()\n            mode: \"100644\"\n            content: file.content()\n            type: \"blob\"\n\nThe filetree `hasUnsavedChanges` if any file in the tree is modified.\n\n        hasUnsavedChanges: ->\n          self.files().select (file) ->\n            file.modified()\n          .length\n\nMarking the filetree as saved resets the modification status of each file.\n\nTODO: There can be race conditions since the save is async.\n\nTODO: Use git trees and content shas to robustly manage changed state.\n\n        markSaved: ->\n          self.files().each (file) ->\n            file.modified(false)\n\n      return self\n\nExport\n\n    module.exports = Filetree\n",
          "type": "blob"
        },
        "main.coffee.md": {
          "path": "main.coffee.md",
          "mode": "100644",
          "content": "Filetree\n========\n\nAn interactive HTML filetree that presents file data in the style of Github API\nrequests.\n\n    module.exports =\n      File: require \"./file\"\n      Filetree: require \"./filetree\"\n      template: require \"./templates/filetree\"\n\n    # TODO: Check if package is root package and then run demo\n    # require \"./demo\"\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "version: \"0.3.0\"\nremoteDependencies: [\n  \"//code.jquery.com/jquery-1.10.1.min.js\"\n  \"//cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js\"\n  \"http://strd6.github.io/tempest/javascripts/envweb.js\"\n]\n",
          "type": "blob"
        },
        "templates/filetree.haml.md": {
          "path": "templates/filetree.haml.md",
          "mode": "100644",
          "content": "Render a list of files as a filetree.\n\n    %ul.filetree\n      - selectedFile = @selectedFile\n      - files = @files\n      - each files, (file) ->\n        %li= file.displayName\n          - on \"click\", (e) ->\n            - selectedFile(file) if $(e.target).is('li')\n          .delete\n            - on \"click\", -> files.remove(file) if confirm(\"Delete #{file.path()}?\")\n            X\n",
          "type": "blob"
        },
        "test/filetree.coffee": {
          "path": "test/filetree.coffee",
          "mode": "100644",
          "content": "{File, Filetree, template} = require \"../main\"\n\ndescribe \"Filetree\", ->\n  it \"should expose a template\", ->\n    assert template\n\n  it \"should expose a Filetree constructor\", ->\n    assert Filetree\n\n  it \"should expose a File constructor\", ->\n    assert File\n      path: \"duder.txt\"\n",
          "type": "blob"
        }
      },
      "distribution": {
        "demo": {
          "path": "demo",
          "content": "(function() {\n  var File, Filetree, demoData, filetree, template;\n\n  File = require(\"./file\");\n\n  Filetree = require(\"./filetree\");\n\n  template = require(\"./templates/filetree\");\n\n  demoData = [\n    {\n      path: \"hey.yolo\",\n      content: \"wat\",\n      type: \"blob\"\n    }\n  ];\n\n  filetree = Filetree();\n\n  filetree.load(demoData);\n\n  filetree.selectedFile.observe(function(file) {\n    return console.log(file);\n  });\n\n  $('body').append(template(filetree));\n\n}).call(this);\n\n//# sourceURL=demo.coffee",
          "type": "blob"
        },
        "file": {
          "path": "file",
          "content": "(function() {\n  var File;\n\n  File = function(I) {\n    var self;\n    if (I == null) {\n      I = {};\n    }\n    Object.defaults(I, {\n      content: \"\"\n    });\n    if (!I.path) {\n      throw \"File must have a path\";\n    }\n    self = Model(I).observeAll();\n    self.extend({\n      extension: function() {\n        return self.path().extension();\n      },\n      mode: function() {\n        var extension;\n        switch (extension = self.extension()) {\n          case \"js\":\n            return \"javascript\";\n          case \"md\":\n            return \"markdown\";\n          case \"cson\":\n            return \"coffee\";\n          case \"\":\n            return \"text\";\n          default:\n            return extension;\n        }\n      },\n      modified: Observable(false),\n      displayName: Observable(self.path())\n    });\n    self.content.observe(function() {\n      return self.modified(true);\n    });\n    self.modified.observe(function(modified) {\n      if (modified) {\n        return self.displayName(\"*\" + (self.path()));\n      } else {\n        return self.displayName(self.path());\n      }\n    });\n    return self;\n  };\n\n  module.exports = File;\n\n}).call(this);\n\n//# sourceURL=file.coffee",
          "type": "blob"
        },
        "filetree": {
          "path": "filetree",
          "content": "(function() {\n  var File, Filetree;\n\n  File = require(\"./file\");\n\n  Filetree = function(I) {\n    var self;\n    if (I == null) {\n      I = {};\n    }\n    Object.defaults(I, {\n      files: []\n    });\n    self = Model(I).observeAll();\n    self.attrObservable(\"selectedFile\");\n    self.extend({\n      load: function(fileData) {\n        var files;\n        if (Array.isArray(fileData)) {\n          files = fileData.sort(function(a, b) {\n            if (a.path < b.path) {\n              return -1;\n            } else if (b.path < a.path) {\n              return 1;\n            } else {\n              return 0;\n            }\n          }).map(File);\n        } else {\n          files = Object.keys(fileData).sort().map(function(path) {\n            return File(fileData[path]);\n          });\n        }\n        return self.files(files);\n      },\n      data: function() {\n        return self.files.map(function(file) {\n          return {\n            path: file.path(),\n            mode: \"100644\",\n            content: file.content(),\n            type: \"blob\"\n          };\n        });\n      },\n      hasUnsavedChanges: function() {\n        return self.files().select(function(file) {\n          return file.modified();\n        }).length;\n      },\n      markSaved: function() {\n        return self.files().each(function(file) {\n          return file.modified(false);\n        });\n      }\n    });\n    return self;\n  };\n\n  module.exports = Filetree;\n\n}).call(this);\n\n//# sourceURL=filetree.coffee",
          "type": "blob"
        },
        "main": {
          "path": "main",
          "content": "(function() {\n  module.exports = {\n    File: require(\"./file\"),\n    Filetree: require(\"./filetree\"),\n    template: require(\"./templates/filetree\")\n  };\n\n}).call(this);\n\n//# sourceURL=main.coffee",
          "type": "blob"
        },
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"version\":\"0.3.0\",\"remoteDependencies\":[\"//code.jquery.com/jquery-1.10.1.min.js\",\"//cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js\",\"http://strd6.github.io/tempest/javascripts/envweb.js\"]};",
          "type": "blob"
        },
        "templates/filetree": {
          "path": "templates/filetree",
          "content": "module.exports = Function(\"return \" + HAMLjr.compile(\"\\n\\n%ul.filetree\\n  - selectedFile = @selectedFile\\n  - files = @files\\n  - each files, (file) ->\\n    %li= file.displayName\\n      - on \\\"click\\\", (e) ->\\n        - selectedFile(file) if $(e.target).is('li')\\n      .delete\\n        - on \\\"click\\\", -> files.remove(file) if confirm(\\\"Delete #{file.path()}?\\\")\\n        X\\n\", {compiler: CoffeeScript}))()",
          "type": "blob"
        },
        "test/filetree": {
          "path": "test/filetree",
          "content": "(function() {\n  var File, Filetree, template, _ref;\n\n  _ref = require(\"../main\"), File = _ref.File, Filetree = _ref.Filetree, template = _ref.template;\n\n  describe(\"Filetree\", function() {\n    it(\"should expose a template\", function() {\n      return assert(template);\n    });\n    it(\"should expose a Filetree constructor\", function() {\n      return assert(Filetree);\n    });\n    return it(\"should expose a File constructor\", function() {\n      return assert(File({\n        path: \"duder.txt\"\n      }));\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/filetree.coffee",
          "type": "blob"
        }
      },
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "version": "0.3.0",
      "entryPoint": "main",
      "remoteDependencies": [
        "//code.jquery.com/jquery-1.10.1.min.js",
        "//cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js",
        "http://strd6.github.io/tempest/javascripts/envweb.js"
      ],
      "repository": {
        "id": 13128952,
        "name": "filetree",
        "full_name": "STRd6/filetree",
        "owner": {
          "login": "STRd6",
          "id": 18894,
          "avatar_url": "https://1.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
          "gravatar_id": "33117162fff8a9cf50544a604f60c045",
          "url": "https://api.github.com/users/STRd6",
          "html_url": "https://github.com/STRd6",
          "followers_url": "https://api.github.com/users/STRd6/followers",
          "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
          "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
          "organizations_url": "https://api.github.com/users/STRd6/orgs",
          "repos_url": "https://api.github.com/users/STRd6/repos",
          "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
          "received_events_url": "https://api.github.com/users/STRd6/received_events",
          "type": "User",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/STRd6/filetree",
        "description": "A simple filetree",
        "fork": false,
        "url": "https://api.github.com/repos/STRd6/filetree",
        "forks_url": "https://api.github.com/repos/STRd6/filetree/forks",
        "keys_url": "https://api.github.com/repos/STRd6/filetree/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/STRd6/filetree/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/STRd6/filetree/teams",
        "hooks_url": "https://api.github.com/repos/STRd6/filetree/hooks",
        "issue_events_url": "https://api.github.com/repos/STRd6/filetree/issues/events{/number}",
        "events_url": "https://api.github.com/repos/STRd6/filetree/events",
        "assignees_url": "https://api.github.com/repos/STRd6/filetree/assignees{/user}",
        "branches_url": "https://api.github.com/repos/STRd6/filetree/branches{/branch}",
        "tags_url": "https://api.github.com/repos/STRd6/filetree/tags",
        "blobs_url": "https://api.github.com/repos/STRd6/filetree/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/STRd6/filetree/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/STRd6/filetree/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/STRd6/filetree/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/STRd6/filetree/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/STRd6/filetree/languages",
        "stargazers_url": "https://api.github.com/repos/STRd6/filetree/stargazers",
        "contributors_url": "https://api.github.com/repos/STRd6/filetree/contributors",
        "subscribers_url": "https://api.github.com/repos/STRd6/filetree/subscribers",
        "subscription_url": "https://api.github.com/repos/STRd6/filetree/subscription",
        "commits_url": "https://api.github.com/repos/STRd6/filetree/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/STRd6/filetree/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/STRd6/filetree/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/STRd6/filetree/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/STRd6/filetree/contents/{+path}",
        "compare_url": "https://api.github.com/repos/STRd6/filetree/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/STRd6/filetree/merges",
        "archive_url": "https://api.github.com/repos/STRd6/filetree/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/STRd6/filetree/downloads",
        "issues_url": "https://api.github.com/repos/STRd6/filetree/issues{/number}",
        "pulls_url": "https://api.github.com/repos/STRd6/filetree/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/STRd6/filetree/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/STRd6/filetree/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/STRd6/filetree/labels{/name}",
        "releases_url": "https://api.github.com/repos/STRd6/filetree/releases{/id}",
        "created_at": "2013-09-26T17:13:32Z",
        "updated_at": "2013-11-03T19:42:48Z",
        "pushed_at": "2013-11-03T19:42:47Z",
        "git_url": "git://github.com/STRd6/filetree.git",
        "ssh_url": "git@github.com:STRd6/filetree.git",
        "clone_url": "https://github.com/STRd6/filetree.git",
        "svn_url": "https://github.com/STRd6/filetree",
        "homepage": null,
        "size": 1068,
        "stargazers_count": 0,
        "watchers_count": 0,
        "language": "CoffeeScript",
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "default_branch": "master",
        "master_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "network_count": 0,
        "subscribers_count": 1,
        "branch": "v0.3.0",
        "defaultBranch": "master"
      },
      "dependencies": {},
      "name": "filetree"
    },
    "runner": {
      "source": {
        "LICENSE": {
          "path": "LICENSE",
          "mode": "100644",
          "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
          "type": "blob"
        },
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "runner\n======\n\nRunner manages running apps in sandboxed windows and passing messages back and forth from the parent to the running instances.\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "version: \"0.2.0\"\nentryPoint: \"runner\"\n",
          "type": "blob"
        },
        "runner.coffee.md": {
          "path": "runner.coffee.md",
          "mode": "100644",
          "content": "Runner\n======\n\nRunner manages running apps in sandboxed windows and passing messages back and\nforth from the parent to the running instances.\n\nWe keep a list of running windows so we can hot-update them when we modify our\nown code.\n\nOne cool example use is if you are modifying your css you can run several\ninstances of your app and navigate to different states. Then you can see in real\ntime how the css changes affect each one.\n\n    runningWindows = []\n\n    Runner = ->\n      run: ({config}={}) ->\n        {width, height} = (config or {})\n\n        sandbox = Sandbox\n          width: width\n          height: height\n\n        runningWindows.push sandbox\n\n        return sandbox\n\nGenerate an html template that runs the given script tag strings as tests.\n\n      testsHtml: (testScripts) ->\n        \"\"\"\n          <html>\n          <head>\n            <meta charset=\"utf-8\">\n            <title>Mocha Tests</title>\n            <link rel=\"stylesheet\" href=\"http://strd6.github.io/tests/mocha.css\"/>\n          </head>\n          <body>\n            <div id=\"mocha\"></div>\n            <script src=\"http://strd6.github.io/tests/assert.js\"><\\/script>\n            <script src=\"http://strd6.github.io/tests/mocha.js\"><\\/script>\n            <script>mocha.setup('bdd')<\\/script>\n            #{testScripts}\n            <script>\n              mocha.checkLeaks();\n              mocha.globals(['jQuery']);\n              mocha.run();\n            <\\/script>\n          </body>\n          </html>\n        \"\"\"\n\n      hotReloadCSS: (css) ->\n        runningWindows = runningWindows.select (window) ->\n          return false if window.closed\n\n          # TODO: We're assuming only one style in the body\n          # which is reasonable in most cases, but we may want\n          # to scope it by the path of the specific css file\n          # to handle a wider range of situations\n          $(window.document).find(\"body style:eq(0)\").html(css)\n\n          return true\n\n    module.exports = Runner\n",
          "type": "blob"
        }
      },
      "distribution": {
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"version\":\"0.2.0\",\"entryPoint\":\"runner\"};",
          "type": "blob"
        },
        "runner": {
          "path": "runner",
          "content": "(function() {\n  var Runner, runningWindows;\n\n  runningWindows = [];\n\n  Runner = function() {\n    return {\n      run: function(_arg) {\n        var config, height, sandbox, width, _ref;\n        config = (_arg != null ? _arg : {}).config;\n        _ref = config || {}, width = _ref.width, height = _ref.height;\n        sandbox = Sandbox({\n          width: width,\n          height: height\n        });\n        runningWindows.push(sandbox);\n        return sandbox;\n      },\n      testsHtml: function(testScripts) {\n        return \"<html>\\n<head>\\n  <meta charset=\\\"utf-8\\\">\\n  <title>Mocha Tests</title>\\n  <link rel=\\\"stylesheet\\\" href=\\\"http://strd6.github.io/tests/mocha.css\\\"/>\\n</head>\\n<body>\\n  <div id=\\\"mocha\\\"></div>\\n  <script src=\\\"http://strd6.github.io/tests/assert.js\\\"><\\/script>\\n  <script src=\\\"http://strd6.github.io/tests/mocha.js\\\"><\\/script>\\n  <script>mocha.setup('bdd')<\\/script>\\n  \" + testScripts + \"\\n  <script>\\n    mocha.checkLeaks();\\n    mocha.globals(['jQuery']);\\n    mocha.run();\\n  <\\/script>\\n</body>\\n</html>\";\n      },\n      hotReloadCSS: function(css) {\n        return runningWindows = runningWindows.select(function(window) {\n          if (window.closed) {\n            return false;\n          }\n          $(window.document).find(\"body style:eq(0)\").html(css);\n          return true;\n        });\n      }\n    };\n  };\n\n  module.exports = Runner;\n\n}).call(this);\n\n//# sourceURL=runner.coffee",
          "type": "blob"
        }
      },
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "version": "0.2.0",
      "entryPoint": "runner",
      "repository": {
        "id": 13482507,
        "name": "runner",
        "full_name": "STRd6/runner",
        "owner": {
          "login": "STRd6",
          "id": 18894,
          "avatar_url": "https://1.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
          "gravatar_id": "33117162fff8a9cf50544a604f60c045",
          "url": "https://api.github.com/users/STRd6",
          "html_url": "https://github.com/STRd6",
          "followers_url": "https://api.github.com/users/STRd6/followers",
          "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
          "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
          "organizations_url": "https://api.github.com/users/STRd6/orgs",
          "repos_url": "https://api.github.com/users/STRd6/repos",
          "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
          "received_events_url": "https://api.github.com/users/STRd6/received_events",
          "type": "User",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/STRd6/runner",
        "description": "Runner manages running apps in sandboxed windows and passing messages back and forth from the parent to the running instances.",
        "fork": false,
        "url": "https://api.github.com/repos/STRd6/runner",
        "forks_url": "https://api.github.com/repos/STRd6/runner/forks",
        "keys_url": "https://api.github.com/repos/STRd6/runner/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/STRd6/runner/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/STRd6/runner/teams",
        "hooks_url": "https://api.github.com/repos/STRd6/runner/hooks",
        "issue_events_url": "https://api.github.com/repos/STRd6/runner/issues/events{/number}",
        "events_url": "https://api.github.com/repos/STRd6/runner/events",
        "assignees_url": "https://api.github.com/repos/STRd6/runner/assignees{/user}",
        "branches_url": "https://api.github.com/repos/STRd6/runner/branches{/branch}",
        "tags_url": "https://api.github.com/repos/STRd6/runner/tags",
        "blobs_url": "https://api.github.com/repos/STRd6/runner/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/STRd6/runner/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/STRd6/runner/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/STRd6/runner/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/STRd6/runner/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/STRd6/runner/languages",
        "stargazers_url": "https://api.github.com/repos/STRd6/runner/stargazers",
        "contributors_url": "https://api.github.com/repos/STRd6/runner/contributors",
        "subscribers_url": "https://api.github.com/repos/STRd6/runner/subscribers",
        "subscription_url": "https://api.github.com/repos/STRd6/runner/subscription",
        "commits_url": "https://api.github.com/repos/STRd6/runner/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/STRd6/runner/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/STRd6/runner/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/STRd6/runner/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/STRd6/runner/contents/{+path}",
        "compare_url": "https://api.github.com/repos/STRd6/runner/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/STRd6/runner/merges",
        "archive_url": "https://api.github.com/repos/STRd6/runner/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/STRd6/runner/downloads",
        "issues_url": "https://api.github.com/repos/STRd6/runner/issues{/number}",
        "pulls_url": "https://api.github.com/repos/STRd6/runner/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/STRd6/runner/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/STRd6/runner/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/STRd6/runner/labels{/name}",
        "releases_url": "https://api.github.com/repos/STRd6/runner/releases{/id}",
        "created_at": "2013-10-10T20:42:25Z",
        "updated_at": "2013-11-08T23:24:31Z",
        "pushed_at": "2013-11-08T23:24:30Z",
        "git_url": "git://github.com/STRd6/runner.git",
        "ssh_url": "git@github.com:STRd6/runner.git",
        "clone_url": "https://github.com/STRd6/runner.git",
        "svn_url": "https://github.com/STRd6/runner",
        "homepage": null,
        "size": 852,
        "stargazers_count": 0,
        "watchers_count": 0,
        "language": "CoffeeScript",
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "default_branch": "master",
        "master_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "network_count": 0,
        "subscribers_count": 1,
        "branch": "v0.2.0",
        "defaultBranch": "master"
      },
      "dependencies": {},
      "name": "runner"
    }
  }
});