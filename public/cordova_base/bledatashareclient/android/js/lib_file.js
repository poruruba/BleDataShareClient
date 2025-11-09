class LibFile{
  constructor(){
  }

  error_message(code){
    switch(code){
        case 1: return "NOT_FOUND_ERR";
        case 2: return "SECURITY_ERR";
        case 3: return "ABORT_ERR";
        case 4: return "NOT_READABLE_ERR";
        case 5: return "ENCODING_ERR";
        case 6: return "NO_MODIFICATION_ALLOWED_ERR";
        case 7: return "INVALID_STATE_ERR";
        case 8: return "SYNTAX_ERR";
        case 9: return "INVALID_MODIFICATION_ERR";
        case 10: return "QUOTA_EXCEEDED_ERR";
        case 11: return "TYPE_MISMATCH_ERR";
        case 12: return "PATH_EXISTS_ERR";
        default: "Unknown error";
    }
  }

  static async newInstance(target){
    var lib = new LibFile();
    await lib.initialize(target);
    return lib;
  }

  async initialize(target = "data"){
    this.target = target;
    if( target == "root" )
      this.target_dir = cordova.file.externalRootDirectory;
    else if( target == "storage" )
      this.target_dir = cordova.file.applicationStorageDirectory;
    else if( target == "data" )
      this.target_dir = cordova.file.externalDataDirectory;
    else
      throw new Error("unknown target");
      
    return new Promise((resolve, reject) =>{
      window.resolveLocalFileSystemURL(this.target_dir, (dirEntry) => {
        this.dir = dirEntry;
        resolve(this);
      }, (error) =>{
        reject(this.error_message(error.code));
      });
    });
  }

  async createFile(dirName, fileName, data){
    return new Promise((resolve, reject) =>{
      this.dir.getDirectory(dirName, {create: true}, (dirEntry) =>{
        dirEntry.getFile(fileName, {create: true, exclusive: false}, (fileEntry) =>{
          fileEntry.createWriter((fileWriter) =>{
            fileWriter.write(data);
            fileWriter.onwriteend = () =>{
              resolve(fileEntry);
            };
            fileWriter.onerror = (error) =>{
              reject(this.error_message(error.code));
            };
          }, (error) =>{
            reject(this.error_message(error.code));
          });
        }, (error) =>{
          reject(this.error_message(error.code));
        });
      }, (error) =>{
        reject(this.error_message(error.code));
      });
    });
  }

  async createDirectory(dirName){
    return new Promise((resolve, reject) =>{
      this.dir.getDirectory(dirName, {create: true, exclusive: true}, (dirEntry) =>{
        resolve(dirEntry);
      }, (error) =>{
        reject(this.error_message(error.code));
      });
    });
  }

  async removeDirectory(dirName){
    return new Promise((resolve, reject) =>{
      this.dir.getDirectory(dirName, {create: false}, (dirEntry) =>{
        dirEntry.removeRecursively(() =>{
          resolve();
        }, (error) =>{
          reject(error);
        });
      }, (error) =>{
        reject(error);
      });
      //   var dirReader = dirEntry.createReader();
      //   dirReader.readEntries((fileEntries) =>{
      //     for (let fileEntry of fileEntries) {
      //       fileEntry.remove();
      //     }
      //     dirEntry.remove(() =>{
      //       resolve();
      //     }, (error) =>{
      //       reject(this.error_message(error.code));
      //     });
      //   }, error =>{
      //     reject(this.error_message(error.code));
      //   });
      // }, (error) =>{
      //   reject(this.error_message(error.code));
      // });
    });
  }

  async getFile(dirName, fileName){
    return new Promise((resolve, reject) =>{
      this.dir.getDirectory(dirName, {create: false}, (dirEntry) =>{
        dirEntry.getFile(fileName, {create: false, reclusive: false}, (fileEntry) =>{
          resolve(fileEntry);
        }, (error) =>{
          resolve(null);
        });
      }, (error) =>{
        resolve(null);
      });
    });
  }

  async isFile(dirName, fileName){
    return new Promise((resolve, reject) =>{
      this.dir.getDirectory(dirName, {create: false}, (dirEntry) =>{
        var dirReader = dirEntry.createReader();
        dirReader.readEntries((fileEntries) =>{
          var target = fileEntries.find(item => item.name == fileName && !item.isDirectory);
          resolve(target);
        }, error =>{
          resolve(null);
        });
      }, (error) =>{
        resolve(null);
      });
    });
  }

  async isDirectory(dirName){
    return new Promise((resolve, reject) =>{
      this.dir.getDirectory(dirName, {create: false}, (dirEntry) =>{
        resolve(dirEntry);
      }, error =>{
        resolve(null);
      });
    });
  }

  async listFiles(dirName){
    return new Promise((resolve, reject) =>{
      this.dir.getDirectory(dirName, {create: false}, (dirEntry) =>{
        var dirReader = dirEntry.createReader();
        dirReader.readEntries((fileEntries) =>{
          resolve(fileEntries);
        }, error =>{
          reject(this.error_message(error.code));
        });
      }, (error) =>{
        reject(this.error_message(error.code));
      });
    });
  }
  
  async removeFile(dirName, fileName){
    return new Promise((resolve, reject) =>{
      this.dir.getDirectory(dirName, {create: false}, (dirEntry) =>{
        dirEntry.getFile(fileName, {create: false, reclusive: false}, (fileEntry) =>{
          fileEntry.remove(() =>{
            resolve();
          }, (error) =>{
            reject(this.error_message(error.code));
          });
        }, (error) =>{
          reject(this.error_message(error.code));
        });
      }, (error) =>{
        reject(this.error_message(error.code));
      });
    });
  }

  async writeFile(dirName, fileName, data){
    return new Promise((resolve, reject) =>{
      this.dir.getDirectory(dirName, {create: false}, (dirEntry) =>{
        dirEntry.getFile(fileName, {create: false, reclusive: false}, (fileEntry) =>{
          fileEntry.createWriter((fileWriter) =>{
            fileWriter.write(data);
            fileWriter.onwriteend = () =>{
              resolve();
            };
            fileWriter.onerror = (error) =>{
              reject(error);
            };
          }, (error) =>{
            reject(this.error_message(error.code));
          });
        }, (error) =>{
          reject(this.error_message(error.code));
        });
      }, (error) =>{
        reject(this.error_message(error.code));
      });
    });
  }

  async readFile(dirName, fileName, response_type = "text"){
    return new Promise((resolve, reject) =>{
      this.dir.getDirectory(dirName, {create: false}, (dirEntry) =>{
        dirEntry.getFile(fileName, {create: false, reclusive: false}, (fileEntry) =>{
          fileEntry.file((file) => {
            var reader = new FileReader();
            reader.onloadend = () => {
              resolve(reader.result);
            };
            reader.onerror = () =>{
              reject(error);
            }
            if( response_type == "binary" )
              reader.readAsArrayBuffer(file);
            else if( response_type == "text" )
              reader.readAsText(file);
            else if( response_type == "dataurl" )
              reader.readAsDataURL(file);
            else
              reject(new Error("unknown response_type"));
          }, (error) =>{
            reject(this.error_message(error.code));
          });
        }, (error) =>{
          reject(this.error_message(error.code));
        });
      }, (error) =>{
        reject(this.error_message(error.code));
      });
    });
  }

  async copyFile(nativeUrl, dirName, fileName){
    return await new Promise((resolve, reject) =>{
        window.resolveLocalFileSystemURL(nativeUrl, (sourceEntry) => {
            this.dir.getDirectory(dirName, {create: false}, (dirEntry) =>{
                sourceEntry.copyTo(dirEntry, fileName, (newFileEntry) => {
                  resolve(newFileEntry);
                }, (error) => {
                  reject(this.error_message(error.code));
                });
            }, (error) => {
              reject(this.error_message(error.code));
            });
        }, (error) => {
            reject(this.error_message(error.code));
        });
    });
  }

  async moveFile(nativeUrl, dirName, fileName){
    return await new Promise((resolve, reject) =>{
        window.resolveLocalFileSystemURL(nativeUrl, (sourceEntry) => {
          this.dir.getDirectory(dirName, {create: false}, (dirEntry) =>{
            sourceEntry.moveTo(dirEntry, fileName, (newFileEntry) => {
                resolve(newFileEntry);
              }, (error) => {
                reject(this.error_message(error.code));
              });
          }, (error) => {
            reject(this.error_message(error.code));
          });
        }, (error) =>{
            reject(this.error_message(error.code));
        });
    });
  }

  async readFromNativeUrl(nativeURL, response_type = "text"){
    return new Promise((resolve, reject) =>{
      resolveLocalFileSystemURL(nativeURL, (fileEntry) =>{
        fileEntry.file((file) => {
          var reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result);
          };
          reader.onerror = (error) => {
            reject(this.error_message(error.code));
          }
          if( response_type == "binary" )
            reader.readAsArrayBuffer(file);
          else if( response_type == "text" )
            reader.readAsText(file);
          else if( response_type == "dataurl" )
            reader.readAsDataURL(file);
          else
            reject(new Error("unknown response_type"));
        }, (error) =>{
          reject(this.error_message(error.code));
        });
      }, (error) =>{
        reject(this.error_message(error.code));
      });
    });
  }

  async getFileEntry(nativeURL){
    return new Promise((resolve, reject) =>{
      resolveLocalFileSystemURL(nativeURL, (fileEntry) =>{
        resolve(fileEntry);
      }, (error) =>{
        reject(error);
      })
    });
  }

  toUrl(dirName, fileName){
    if( this.target == "root" )
      return "https://localhost/__cdvfile_sdcard__/" + dirName + "/" + fileName;
    else if( this.target == "storage" )
      return "https://localhost/__cdvfile_files__/" + dirName + "/" + fileName;
    else if( this.target == "data" )
      return "https://localhost/__cdvfile_files-external__/" + dirName + "/" + fileName;
    else
      throw new Error("unknown target");
  }
}