compileTemplate = (source, name="test") ->
  ast = HAMLjr.parser.parse(source)
  
  HAMLjr.compile ast, 
    name: name
    compiler: CoffeeScript

build = ->  
  templates = []
  models = []

  filetree.files.each (file) ->
    name = file.filename()
    source = file.content()

    if name.extension() is "haml"
      templates.push compileTemplate(source, name.withoutExtension())
  
    else if name.extension() is "coffee"
      # Skip main
      return if name is "main.coffee"

      models.push CoffeeScript.compile(source)

  main = CoffeeScript.compile(Gistquire.Gists[gistId].files["main.coffee"].content)

  """
    #{templates.join("\n")}
    #{models.join("\n")}
    #{main}
  """

model =
  save: ->
    fileData =
      "build.js":
        content:  build()

    # TODO: Handle deleted files

    # Merge in each file
    filetree.files.each (file) ->
      fileData[file.filename] =
        content: file.content()

    Gistquire.update gistId,
      files: fileData

files = Object.keys(Gistquire.Gists[gistId].files).map (filename) ->
  data = Gistquire.Gists[gistId].files[filename]
  
  File(data)

filetree = Filetree
  files: files

filetree.selectedFile.observe (file) ->
  $("textarea").remove()
  $("body").append(HAMLjr.templates.editor(file))

$("body")
  .append(HAMLjr.templates.actions(model))
  .append(HAMLjr.templates.filetree(filetree))