import React, { useState, useRef, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import axiosRetry from "axios-retry";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { editPostText } from "../../actions";

axiosRetry(axios, { retries: 3, retryCondition: (_error) => true });

export const copyText = (string) => {
  let textarea;

  try {
    textarea = document.createElement("textarea");
    textarea.setAttribute("readonly", true);
    textarea.setAttribute("contenteditable", true);
    textarea.style.position = "fixed"; // prevent scroll from jumping to the bottom when focus is set.
    textarea.value = string;

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    const range = document.createRange();
    range.selectNodeContents(textarea);

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    textarea.setSelectionRange(0, textarea.value.length);
    document.execCommand("copy");
  } catch (err) {
    console.error(err);
  } finally {
    document.body.removeChild(textarea);
  }
};

export const fixMediaSize = (
  img,
  minRatio,
  maxRatio,
  parent = null,
  depth = 0
) => {
  if (img.naturalHeight > 0.0) {
    var ratio = img.naturalWidth / img.naturalHeight;

    //console.log("Original ratio: " + ratio.toFixed(2), img.src);
    if (maxRatio && ratio > maxRatio) {
      ratio = maxRatio;
      //console.log("Changed to: " + ratio.toFixed(2));
    } else if (minRatio && ratio < minRatio) {
      ratio = minRatio;
      //console.log("Changed to: " + ratio.toFixed(2));
    }

    var padding = 100 / ratio;
    var padding_str = padding.toFixed(2) + "%";

    const div = parent ? parent : img.parentNode;
    if (div) {
      div.style.setProperty("--aspect_ratio", padding_str);
    }
  } else if (depth < 50) {
    //console.log("Wait for image to load...");
    setTimeout(() => {
      fixMediaSize(img, minRatio, maxRatio, parent, depth + 1);
    }, 50);
  }
};

export async function downloadFile(media, mediaType) {
  await toast.promise(
    axios
      .get(media, { responseType: "blob" })
      .then((response) => {
        return response.data;
      })
      .then((blob) => {
        var file = new File([blob], "blob", {
          type:
            mediaType === "video"
              ? "video/mp4"
              : mediaType === "gif" || mediaType === "giphy"
              ? "image/gif"
              : "image/jpeg",
        });
        saveDownloadedFile(file);
      })
      .catch((err) => {
        if (!err instanceof DOMException || err.name !== "AbortError") {
          console.log(err);
          alert("Failed to download file!");
        }
      }),
    {
      pending: "Downloading media...",
      success: "Media download successful",
      error: "Media download failed. Please try again.",
    }
  );
}

export function saveDownloadedFile(file) {
  let tempUrl = URL.createObjectURL(file);
  let aTag = document.createElement("a");
  aTag.href = tempUrl;
  aTag.download = tempUrl.replace(/^.*[\\/]/, "");
  document.body.appendChild(aTag);
  aTag.click();
  URL.revokeObjectURL(tempUrl);
  aTag.remove();
}

export function scrollToTargetAdjusted(target, depth = 0) {
  if (depth < 10) {
    const element = document.getElementById(target);
    if (element) {
      element.scrollIntoView({
        behavior: "auto" /*or smooth*/,
        block: "center",
      });
    } else {
      console.log(target, "not found!");
      setTimeout(() => {
        scrollToTargetAdjusted(target, depth + 1);
      }, 50);
    }
  }
}

export function isTwitterMediaLink(url) {
  if (
    (url.includes("https://twitter.com/") &&
      url.includes("status") &&
      url.includes("video")) ||
    url.includes("https://pic.twitter.com/")
  ) {
    return true;
  } else {
    return false;
  }
}

export const ReadMore = ({ enable, children }) => {
  const [isReadMore, setIsReadMore] = useState(true);
  const toggleReadMore = () => {
    setIsReadMore(!isReadMore);
  };

  var text = "";
  var displayChildren = [];
  var shortenText = false;

  if (typeof children[0] === "string" || children[0] instanceof String) {
    if (children[0].length > 450) {
      displayChildren.push(children[0].slice(0, 400).trimEnd());
      shortenText = true;
    }
  } else {
    for (let i = 0; i < children[0].length; i++) {
      if (
        typeof children[0][i] === "string" ||
        children[0][i] instanceof String
      ) {
        if (!shortenText) {
          if (text.length + children[0][i].length > 450) {
            displayChildren.push(
              children[0][i].slice(0, Math.max(1, 400 - text.length)).trimEnd()
            );
            shortenText = true;
          } else {
            text += children[0][i];
            displayChildren.push(children[0][i]);
          }
        }
      } else if (!shortenText) {
        text += "[[text]]";
        displayChildren.push(children[0][i]);
      } else if (shortenText && isReadMore) {
        if (children[0][i]["props"] && children[0][i]["props"]["open"]) {
          setIsReadMore(false);
          break;
        }
      }
    }
  }

  return (
    <>
      {enable && isReadMore && shortenText ? displayChildren : children}
      {enable && shortenText && (
        <span onClick={toggleReadMore} className="read-or-hide">
          {isReadMore ? "... read more" : " show less"}
        </span>
      )}
    </>
  );
};

export const EditableTextContent = ({
  initialText,
  placeholderText,
  onChange,
  platformColor,
  postID,
  insertText,
}) => {
  const textareaRef = useRef(null);
  const [text, setText] = useState(() => {
    let formattedText = initialText;
    const regex = /\[\[(.*?)\]\]/g;
    let matches = [];
    let match = regex.exec(initialText);

    while (match !== null) {
      matches.push(match);
      match = regex.exec(initialText);
    }

    matches.forEach((match, index) => {
      const [fullMatch, innerText] = match;
      const replacement = insertText[index];
      if (typeof replacement !== "undefined" && replacement !== "") {
        formattedText = formattedText.replace(
          fullMatch,
          `<span style="font-style: italic;">${replacement}</span>`
        );
      } else {
        formattedText = formattedText.replace(
          fullMatch,
          `<span style="font-style: italic;">${innerText}</span>`
        );
      }
    });

    formattedText = formattedText.replace(/\[\[.*?\]\]/g, "");

    return formattedText;
  });

  const dispatch = useDispatch();

  // Function to adjust the height of the textarea element to fit the content
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // Focus on the textarea element and place the cursor at the end of the text
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();

      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(textareaRef.current);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);

      adjustTextareaHeight();
    }
  }, []);

  // Close the textarea if clicked outside it and remove span tags
  useEffect(() => {
    const handleClick = (event) => {
      if (textareaRef.current && !textareaRef.current.contains(event.target)) {
        const innerHTML = textareaRef.current.innerHTML;
        const regex = /<span[^>]*>(.*?)<\/span>/g;
        let updatedText = "";
        let insertIndex = 0;

        const originalTextArray = initialText.match(/\[\[(.*?)\]\]/g);

        updatedText = innerHTML.replace(regex, (match, innerText) => {
          let newText = insertText[insertIndex].trim();
          const originalText = originalTextArray[insertIndex];
          insertIndex++;

          if (newText === "") {
            return originalText;
          } else if (innerText === newText) {
            return originalText;
          } else {
            return newText;
          }
        });

        setText(updatedText);

        if (onChange) {
          onChange(updatedText);
        }

        dispatch(editPostText(postID, updatedText));
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [textareaRef, onChange, text, postID, dispatch, insertText, initialText]);

  const handleChange = useCallback(
    (event) => {
      event.preventDefault();

      const newText = event.target.innerHTML;
      setText(newText);
      if (onChange) {
        onChange(newText);
      }

      adjustTextareaHeight();
    },
    [textareaRef, onChange]
  );

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [text]);

  // Prevents <br> and <div></div> tags from being appended to the end of text when user creates new line
  const handleKeyDown = useCallback((event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const range = window.getSelection().getRangeAt(0);
      range.deleteContents();
      const newline = document.createTextNode("\n"); // Create a newline character
      range.insertNode(newline);
      range.setEndAfter(newline);
      range.setStartAfter(newline);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      adjustTextareaHeight();
    }
  }, []);

  return (
    <div className="textarea-container">
      <div
        ref={textareaRef}
        contentEditable
        dangerouslySetInnerHTML={{ __html: text }}
        placeholder={placeholderText}
        className="editable-textarea"
        style={{
          "--platform_color": platformColor,
          outline: "none",
          border: "none",
          caretColor: platformColor,
          resize: "none",
          width: "100%",
          height: "auto",
          overflow: "hidden",
          whiteSpace: "pre-wrap",
          wordWrap: "break-word",
        }}
        onBlur={handleChange}
        onPaste={handlePaste}
        onInput={adjustTextareaHeight}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};

export const ContentEditableWithRef = (props) => {
  const defaultValue = useRef(props.value);

  const handleInput = (event) => {
    if (props.onChange) {
      props.onChange(event, props.index);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    var text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  return (
    <span
      style={{
        "--placeholder-text": '"' + props.placeholderText + '"',
        "--platform_color": props.platformColor,
      }}
      contentEditable="true"
      key={props.index}
      className={`fill-in-the-blank`}
      onInput={(e) => handleInput(e)}
      onPaste={(e) => handlePaste(e)}
      dangerouslySetInnerHTML={{ __html: defaultValue.current }}
    ></span>
  );
};

export const addhttp = (url) => {
  if (!/^(?:f|ht)tps?:\/\//.test(url)) {
    url = "http://" + url;
  }
  return url;
};
