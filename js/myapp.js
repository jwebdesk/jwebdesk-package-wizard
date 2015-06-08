// -----------------------------------------------------
// Estas cosas deberían estar dentro de jwebdesk
var jw_apptoken = null;
var jw_appid = "jwebdesk~jwebdesk-package-wizard@init";
var main_package = "jwebdesk~jwebdesk-package-wizard@init";
requirejs(["jwebkit", "jwebdesk"], function (jwk, jwebdesk) {    
    jw_apptoken = jwk.urlParam("apptoken");
    jwebdesk.repository.require([
        main_package
    ])
});
// -------------------------------------------------
function start(jwebdesk) {
    
    App = Ember.Application.create();
    App.Router.map(function() {        
        this.resource('package', function () {
            this.route('id', {path: "/id"});
            this.route('code', {path: "/code"});
            this.route('deps', {path: "/deps"});
            this.route('finish', {path: "/finish"});
        });
    });
    
    window.wizard = new jwebdesk.App({
        "jwebdesk": {
            "init_ontop": true
        }
    });
    
    console.log("window.wizard.params: " + window.wizard.params);
    window.wizard.load_drives().done(function (lista){
    });    
    
    var package_model = Ember.Object.extend();
    
    App.PackageRoute = Ember.Route.extend({
        "actions": {
            "changeType": function (newValue) {
                this.get("controller").set("type", newValue);                
            },
            "changeOwner": function (newValue) {
                this.get("controller").set("owner", newValue);                
            },
            "changeTemplate": function (newValue) {
                this.get("controller").set("temp", newValue == "None" ? null : newValue);                
            },
            "addDependency": function () {
                var ctrl = this.get("controller");
                if (ctrl.get("new_dep") == "") return;
                // HACK: el pushObject no hacía que se actualizara el deps_count
                var list =  ctrl.get("deps").map(function (n){return n});
                list.push(ctrl.get("new_dep"));
                ctrl.set("deps",list);
                // -----------------
                ctrl.set("new_dep", "");
            },
            "removeDependency": function (dep) {
                var ctrl = this.get("controller");
                // HACK: el removeObject no hacía que se actualizara el deps_count
                var list =  ctrl.get("deps").map(function (n){return n});
                for (var i=list.length-1; i>=0; i--) {
                    if (list[i] === dep) {
                        list.splice(i, 1);
                    }
                }
                ctrl.set("deps",list);
                // -----------------
            },
            "githubConnect": function () {
                console.log("githubConnect()");
                var ctrl = this.get("controller");
                wizard.load_drives().then(function (list) {
                    console.assert(list["github"], wizard);
                    list["github"].get("root").nodes().then(function (nodes, parent) {
                        console.assert(Array.isArray(nodes), nodes);
                        console.assert(nodes.length > 0, nodes);
                        var list = nodes.map(function(node){
                            return node.name;
                        });
                        ctrl.set("github", list);
                        ctrl.set("owner", list[0]);                    
                    })
                })
            },
            "editCode": function () {
                var ctrl = this.get("controller");
                console.log("editCode()", ctrl.get("opfolders_path"));
                /*
                - tengo que hablar con el drive-manager y pedirle un acltoken y pasarle los parámetros
                - sería permiso de escritura sobre el directorio:
                  package:/<owner>/<package_name>/master/
                  
                */
                
                window.wizard.create_acltoken({
                    drive: {
                        package: {
                            w: [ctrl.get("opfolders_path")]
                        }
                    }
                }).then(function (acltoken) {
                    console.log("openFiles:", ctrl.get("openFiles"));
                    jwebdesk.open_app("vapaee~bracketsonline-net@current", {
                    //jwebdesk.open_app("opfolders-browser", {
                        "acltoken":acltoken,
                        "apptoken":window.wizard.get_token(),
                        "openProject":ctrl.get("opfolders_path"),
                        "openFiles":ctrl.get("openFiles"),
                    }).done(function (brackesonline) {
                        console.log("brackesonline:", brackesonline);
                    });
                    
                }); 
            },
            "openApp": function () {
                console.log("openApp()", this.get("controller").get("packid"));
                jwebdesk.open_app(this.get("controller").get("packid")).done(function (newapp) {
                    console.log("newapp:", newapp);
                });
            },
            
            "githubInitRepo": function () {
                console.log("githubInitRepo()");
                var ctrl = this.get("controller");                
                var package = JSON.parse(ctrl.get("json"));
                var repo_name = ctrl.get("name");
                var owner_name = ctrl.get("owner");
                var template = ctrl.get("temp");                
                
                wizard.load_drives().then(function (drives) {
                    console.log("Drives: ", drives);
                    console.assert(drives.github, "ERROR: github drive needed but not present", [drives]);
                    ctrl.set("current_action", "Creating repository on GitHub");
                    ctrl.set("progress", "0");

                    var root = drives.github.get("root");
                    
                    // -----------------
                    root.nodes().done(function (nodes) {
                        console.log("root.nodes(): ", arguments);
                        console.assert(Array.isArray(nodes), nodes);
                        var node = nodes[0];
                        for (var i in nodes) {
                            if (nodes[i].name == owner_name)  node = nodes[i];
                        };
                        
                        ctrl.set("current_action", "Creating repository on GitHub");
                        ctrl.set("progress", "5");
                        node.mkdir(ctrl.get("name")).then(function (repo) {
                            var path = "/templates/package/"+ctrl.get("type")+"/" + ctrl.get("temp");
                            console.log("REP: ", path, "-->", repo);
                            ctrl.set("current_action", "Obtaining template files");
                            ctrl.set("progress", "12");
                            return $.when(repo, drives.content.get("root").stat(path));
                        }).then(function (repo, app_dir) {
                            console.log("app_dir.copy_to(repo)", app_dir, "-->", repo);
                            ctrl.set("progress", "14");
                            ctrl.set("current_action", "Uploading template files to your GitHub repository");
                            return app_dir.copy_to(repo);
                        }).then
                        (function () {
                            var repo_name = ctrl.get("name");
                            var owner_name = ctrl.get("owner");
                            var template = ctrl.get("temp");
                            ctrl.set("current_action", "Creating package in jwebdesk");
                            console.log("termino el copiado ahora voy a crear el paquete -------- !!");                            
                            jwebdesk.repository.create_package(package).done
                            
                            // -----------------
                            (function(result) {
                                ctrl.set("current_action", "Cloning your GitHub repository in jwebdesk");
                                ctrl.set("progress", "72");
                                if (typeof result == "string") try { 
                                    result = JSON.parse(result);
                                } catch (e) { console.error("ERROR: not JSON format: ", result)}
                                console.log("Terminé de crear el paquete:", arguments);
                                console.log("mando crear: /" + owner_name);
                                drives.package.get("root").stat("/" + owner_name, {isFolder: true}).then(function (node) {
                                    ctrl.set("progress", "81");
                                    console.log("mando crear: /"+owner_name+"/"+repo_name);
                                    return node.stat("/"+owner_name+"/"+repo_name, {isFolder: true});
                                }).then(function (node) {
                                    ctrl.set("progress", "89");
                                    console.log("mando crear: /"+owner_name+"/"+repo_name+"/master",
                                                ctrl.get("repo_url"), "token: ", jwk.getCookie("github-access-token"));
                                    return node.stat("/"+owner_name+"/"+repo_name+"/master", {
                                        isFolder: true,
                                        github_token: jwk.getCookie("github-access-token"),
                                        repo: ctrl.get("repo_url")
                                    });
                                }).then(function () {
                                    ctrl.set("current_action", "Done");
                                    ctrl.set("progress", "100");
                                    
                                    return jwebdesk.wait_service("package-manager").done(function(manager) {
                                        console.log("Instalo el paquete: ", ctrl.get("packid"));
                                        manager.install(ctrl.get("packid"));
                                    });                                    
                                    
                                });                                
                            })
                            // ()
                            ;
                        
                        // -----------------
                        })
                        
                        ;
                    
                     }); // root.nodes().done(function (nodes) {
                    // -----------------
                    

                }); // wizard.load_drives().then(function (drives) {
            }
            
        }
    });
    
    
    App.Controller = Ember.ObjectController.extend({
        "init": function () {
            var ctrl = this;
            
            jwebdesk.wait_service("user-auth").then(function (user){
                return user.logged();
            }).then(function (is_logged, user) {
                // console.log("ctrl.jw_user = ", user);
                ctrl.set("jw_user", user);
            });
        },
        "jw_user": "pending",
        "isPending": function () {
            return this.get("jw_user") == "pending";
        }.property("jw_user"),
    });

    App.PackageController = Ember.ObjectController.extend({
        "init": function () {
            var ctrl = this;
            
            this.url_base = function (state) {
                var http_base = "http://raw.jwebdesk.com/" + this.get('owner') + "/" + this.get("name");
                switch (state) {
                    case "dev": return http_base + "/master/";
                    case "debug": return  http_base + "/" + this.get("version") + "/";
                    case "prod": return  http_base + "/" + this.get("version") + "/";
                }
            }
            
            wizard.load_drives().then(function (list) {                
                console.assert(list["content"], list, wizard);
                list["content"].get("root").stat("/templates/package/" + ctrl.get("type")).then(function (node) {
                    return node.nodes();
                }).then(function (nodes, parent) {                    
                    console.assert(Array.isArray(nodes), nodes);
                    console.assert(nodes.length > 0, nodes);
                    var list = nodes.map(function(node){
                        return node.name;
                    });
                    list.unshift("None");
                    ctrl.set("templates", list);
                    ctrl.set("temp", list[0]);                
                });        
            })            
        },
        "category": function () {
            if (this.get("type") == "setup") return "app"; 
        }.property("type"),
        "title": "",
        "default_link_filename": function () {
            switch(this.get("link_type")){
                case "js": return this.get("state") == "prod" ? "main.min" : "main";
                case "html": return "index";
                case "less":
                case "css": return this.get("type");
            }
        }.property("state","link_type","type"),
        "url": function() {
            return this.url_base(this.get("state"));
        }.property('state', 'owner', 'name', 'version'),
        "opfolders_path": function() {
            var result = "package:/" + this.get('owner') + "/" + this.get("name");
            console.log("opfolders_path()->", result);
            return result;
        }.property('owner', 'name'),
        "openFiles": function() {
            var result = JSON.stringify([this.get('opfolders_path') + "/master/" + this.get("default_link_filename") + "." + this.get("link_type")]);
            console.log("openFiles()->", result);
            return result;
        }.property('owner', 'name', 'link_type'),
        "url_dev": function() {
            return this.url_base("dev") + "index." + this.get("link_type");
        }.property('owner', 'name', 'version', 'link_type', 'temp'),
        "url_debug": function() {
            return this.url_base("debug") + "index." + this.get("link_type");
        }.property('owner', 'name', 'version'),
        "url_prod": function() {
            return this.url_base("prod") + "index." + this.get("link_type");
        }.property('owner', 'name', 'version'),
        "version": "",
        "github": false,        
        "temp": false,
        "create_code": true,
        "brief": "",
        "type": "setup",
        "repo_url": function () {
            return "https://github.com/" + this.get("owner") + "/" + this.get("name") + ".git";
        }.property('owner', 'name'),
        "codetype": function () {
            return this.get("codetypes")[0].val;
        }.property("codetypes"),
        "codetypes": function (){
            var list = [];
            switch (this.get("type")) {
                case "setup":
                    list.push({"val":"json", "display":"HTML"});
                    break;
                case "skin":
                    list.push({"val":"less", "display":"Less"});
                    list.push({"val":"css", "display":"CSS3"});
                    break;
                case "plugin":
                    list.push({"val":"js", "display":"Less"});
                    break;
                case "plugin":
                    list.push({"val":"js", "display":"Less"});
                    break;
                case "config":
                    list.push({"val":"json", "display":"JSON"});
                    break;
                default:
                    list.push({"val":"meta", "display":"???"});
                    break;
            }
            return list;
        }.property("type"),
        "state": "dev",
        "skined": function () {
            switch (this.get("type")) {
                case "setup": return { "dev": "style/skin.less", "prod": "style/skin.min.less"};
            }
        }.property("type"),
        "packid": function () {
            return this.get("owner") + "~" + this.get("name") + "@" + this.get("version");
        }.property("owner", "name", "version"),
        "owner": "",
        "name": "",
        "publisher": "1",
        "scope": "",
        "new_dep": "",
        "addDepDisabled": function () {
            return this.get("new_dep") == "";
        }.property("new_dep"),
        "link_type": function () {
            console.log("link_type() -->", this.get("temp"), typeof this.get("temp") );
            if (typeof this.get("temp") != "string") return;            
            var template_parts = this.get("temp").split("-");
            return template_parts[template_parts.length-1];
        }.property("temp"),
        "json": function () {
            var json = {
                "title": this.get("title"),
                "version": this.get("version"),
                "brief": this.get("brief"),
                "type": this.get("type"),
                "codetype": this.get("codetype"),
                "state": this.get("state"),
                "config": {
                    "mainmenu": {
                        "menu-id": "access"
                    }
                },
                "owner": this.get("owner"),
                "name": this.get("name"),
            }
            if (this.get("category")) json.category = this.get("category");
            if (this.get("create_code")) {
                json.repository = {
                    "type": "git",
                    "url": this.get("repo_url"),
                    "branch": "master",
                    "SHA": ""
                }
                if (this.get("link_type") == "js") {
                    json.startpoint = {
                        "type": "code",
                        "codetype": "js",
                        "url_dev": this.get("url_dev"),
                        "url_debug": this.get("url_debug"),
                        "url_prod": this.get("url_prod")
                    }
                } else {
                    json.url_dev = this.get("url_dev");
                    json.url_debug = this.get("url_debug");
                    json.url_prod = this.get("url_prod");
                }
                
                if (this.get("skined")) {
                    json["default-skin"] = {
                        "type": "skin",
                        "codetype": "less",
                        "url_dev":   this.get("url") + this.get("skined").dev,
                        "url_debug":  this.get("url") + this.get("skined").dev,
                        "url_prod":  this.get("url") + this.get("skined").prod,
                    };
                    json.config.skin = "default-skin";
                }
                
                if (this.get("deps").length > 0) {
                    json["require"] = this.get("deps");                    
                }
            } else {
                json.url = this.get("custom_url_dev");
                console.error("custom_url_dev not implemented")
            }
            return JSON.stringify(json, true, 4);
        }.property("title", "version", "brief", "type", "codetype", "owner", "name", "skined", "url", "link_type", "deps", "create_code", "temp"),
        "is_app": function (){
            return this.get("type") == "setup";
        }.property("type"),
        "type_txt": [
            {"val":"setup", "name":"Application"},
            {"val":"skin", "name":"Skin"},
            {"val":"plugin", "name":"Plugin"},
            {"val":"library", "name":"Library"},
            {"val":"config", "name":"Configuration"},
            {"val":"iconset", "name":"Icon Set"}
        ],
        "templates": [],
        "current_action": null,
        "progress": null,
        "deps": [],
        "deps_count": function () {
            return this.get("deps").length;
        }.property("deps"),
        "package_type": function (key, value, aaa) {
            var type = this.get("type");
            if (arguments.length == 1) {
                var list = this.get("type_txt");
                console.assert(Array.isArray(list), list);
                for (var i=0; i<list.length; i++ ) {
                    if (list[i].val == type) return list[i].name;
                }
                return "NOSE";
            };
        }.property("type")
    });
    
    App.PackageIdController = Ember.ObjectController.extend({
        "init" : function () {
            var binding;
            binding = Ember.Binding.from("controllers.package.is_app").to("is_app"); binding.connect(this);            
            binding = Ember.Binding.from("controllers.package.brief").to("brief"); binding.connect(this);            
            binding = Ember.Binding.from("controllers.package.title").to("title"); binding.connect(this);            
            binding = Ember.Binding.from("controllers.package.type").to("type"); binding.connect(this);            
            binding = Ember.Binding.from("controllers.package.type_txt").to("type_txt"); binding.connect(this);            
            binding = Ember.Binding.from("controllers.package.name").to("name"); binding.connect(this);            
            binding = Ember.Binding.from("controllers.package.create_code").to("create_code"); binding.connect(this);            
            binding = Ember.Binding.from("controllers.package.package_type").to("package_type"); binding.connect(this);            
        },
        "needs": ["package"]        
    });
    
    App.PackageCodeController = Ember.ObjectController.extend({
        "init" : function () {
            var binding;
            binding = Ember.Binding.from("controllers.package.codetypes").to("codetypes"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.codetype").to("codetype"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.type").to("type"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.temp").to("temp"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.templates").to("templates"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.github").to("github"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.name").to("name"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.owner").to("owner"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.version").to("version"); binding.connect(this);            
        },
        "needs": ["package"]        
    });
    
    App.PackageDepsController = Ember.ObjectController.extend({
        "init" : function () {
            var binding;
            binding = Ember.Binding.from("controllers.package.deps").to("deps"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.new_dep").to("new_dep"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.deps_count").to("deps_count"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.addDepDisabled").to("addDepDisabled"); binding.connect(this);
        },
        "new_dep": "",
        "needs": ["package"]        
    });
    
    App.PackageFinishController = Ember.ObjectController.extend({
        "init" : function () {
            var binding;            
            binding = Ember.Binding.from("controllers.package.packid").to("packid"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.current_action").to("current_action"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.progress").to("progress"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.link_type").to("link_type"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.deps").to("deps"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.json").to("json"); binding.connect(this);            
            binding = Ember.Binding.from("controllers.package.type").to("type"); binding.connect(this);            
            binding = Ember.Binding.from("controllers.package.type_txt").to("type_txt"); binding.connect(this);            
            binding = Ember.Binding.from("controllers.package.name").to("name"); binding.connect(this);            
            binding = Ember.Binding.from("controllers.package.create_code").to("create_code"); binding.connect(this);            
            binding = Ember.Binding.from("controllers.package.package_type").to("package_type"); binding.connect(this);                        
            binding = Ember.Binding.from("controllers.package.temp").to("temp"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.templates").to("templates"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.github").to("github"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.name").to("name"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.owner").to("owner"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.version").to("version"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.deps").to("deps"); binding.connect(this);
            binding = Ember.Binding.from("controllers.package.deps_count").to("deps_count"); binding.connect(this);
        },
        "new_dep": "",
        "needs": ["package"],
        "isDone": function () {
            /*
            return true;
            /*/
            return ("" + this.get("progress")) == "100";
            //*/
        }.property("progress"),
        "progressStyle": function () {
            return "width: " + this.get("progress") + "%;";
        }.property("progress")
    });
    
}

requirejs(["jwebdesk"], function (jwebdesk) {
    jwebdesk.repository.require([
        "jquery",
        "handlebars",
        "bootstrap",
        "ember",
        // "bootstrap-superhero",
        "bootstrap-slate"
    ]).then(function (){
        start(jwebdesk);
    });
});