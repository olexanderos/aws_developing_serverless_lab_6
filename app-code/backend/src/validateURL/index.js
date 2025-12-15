
export const handler = async message => {
  
  let bookmark = message;
  try {
      //if (!bookmark.bookmarkUrl.includes("bad"))
      var regex = /(www):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
      console.log("bookmark is "+bookmark);
      const bookmarkDetails = JSON.stringify(bookmark);
      console.log("bookmarkDetails are "+bookmarkDetails);
      const bookmarkItem = JSON.parse(bookmarkDetails);
      console.log(bookmarkItem.detail.payload.bookmarkUrl.S);
      if(!regex.test(bookmarkItem.detail.payload.bookmarkUrl.S))
      {
        return "Invalid";
      }
      else
        return "Valid";
    } catch (err) {
     console.log(err);
    }
  };
