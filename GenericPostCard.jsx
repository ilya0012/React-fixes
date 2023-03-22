import React, { useEffect, useState, useRef } from "react";
import {
  Card,
  Image,
  Modal,
  Header,
  Button,
  Embed,
  Popup,
  Dropdown,
  Icon,
} from "semantic-ui-react";
import { useSelector, useDispatch } from "react-redux";
import {
  copyText,
  downloadFile,
  fixMediaSize,
  scrollToTargetAdjusted,
  isTwitterMediaLink,
  ReadMore,
  ContentEditableWithRef,
  EditableTextContent,
} from "../utils/functions";
import {
  shareLink,
  shareNativeWithFile,
  shareNativeWithoutFile,
  pickShareBehavior,
  instagramIcon,
} from "../utils/sharing";
import {
  gtagPostShare,
  setEditing,
  shortenUrl,
  trackPostShare,
} from "../../actions";
import reactStringReplace from "react-string-replace";
import "./PostCard.scss";
import { setShare } from "../utils/Amplitude";
import { isMobile } from "react-device-detect";
import { ButtonContainer, PrimaryCard } from "../styled-components";

const GenericPostCard = (props) => {
  const state = useSelector((state) => state.sharer);
  const dispatch = useDispatch();
  const whitelabel = state.whitelabel;
  const hashtags = props.hashtags;
  const [open, setOpen] = useState(false);
  const [mediaModal, setMediaModal] = useState(false);
  const [mediaModalMobile, setMediaModalMobile] = useState(false);
  const [link, setLink] = useState();
  const [linkCaption, setLinkCaption] = useState();
  const [parsedLink, setParsedLink] = useState();
  const [shortenedLink, setShortenedLink] = useState();
  const regex = new RegExp("$(?:\n)", "g");
  const addSpace = !regex.test(props.text);
  const [fillIn, setFillIn] = useState(false);
  const [insertText, setInsertText] = useState([""]);
  const [popup, setPopup] = useState(false);
  const [popupField, setPopupField] = useState(0);
  const [rect, setRect] = useState(null);
  const [displayImageFooter, setDisplayImageFooter] = useState();
  const [fullText, setFullText] = useState(
    addSpace ? `${props.text} ${hashtags}` : `${props.text}${hashtags}`
  );
  const [editedText, setEditedText] = useState(fullText);
  const [isHovered, setIsHovered] = useState(false);
  const postID = props.id;
  const { editing } = props;
  const customText = state.customText;

  const mediaType = props.image.videoURL
    ? "video"
    : props.image.gifURL
    ? "gif"
    : props.image.imageURL.includes("giphy")
    ? "giphy"
    : props.youtubeID
    ? "youtube"
    : "image";
  const media =
    mediaType === "video"
      ? props.image.videoURL
      : mediaType === "gif"
      ? props.image.gifURL
      : props.image.imageURL;

  const shareBehavior = pickShareBehavior(
    props.strategy.behavior,
    isMobile && props.deviceInfo.nativeSharingAvailable,
    mediaType,
    props.deviceInfo.os
  );

  function checkFillInTheBlank() {
    console.log(fillIn, "FILL IN");
    if (!fillIn) {
      console.log("RETURNED TRUE");
      return true;
    }

    let retValue = true;
    insertText.map((text, idx) => {
      if (retValue) {
        if (text === "") {
          setPopupField(idx);
          setPopup(true);
          retValue = false;
        } else {
          setPopup(false);
        }
      }
    });

    return retValue;
  }

  const trackShare = (shareType = undefined) => {
    console.log(
      "TRACKING SHARE",
      shareType ? shareType : props.strategy.config.platformName
    );
    dispatch(
      trackPostShare(
        {
          campaignID: props.campaignID,
          sharedText: fullText,
          shared_url: mediaType === "image" ? parsedLink : "",
          sharedPlatform: shareType
            ? shareType
            : props.strategy.config.platformName,
          sharedImageURL: media,
          postType: "Ready Made Post",
          embed: state.wp,
          email: false,
        },
        state.apiMode
      )
    );

    if (state.apiMode === "prod") {
      dispatch(
        gtagPostShare({
          campaign_id: props.campaignID,
          campaign_name: state.readyMadeData.campaign.name,
          shared_text: fullText,
          shared_url: mediaType === "image" ? parsedLink : "",
          shared_platform: shareType
            ? shareType
            : props.strategy.config.platformName,
          shared_image_url: media,
          post_type: state.mode,
        })
      );
      setShare({
        Platform: shareType ? shareType : props.strategy.config.platformName,
      });
    }
  };

  const optimize = async () => {
    if (!checkFillInTheBlank()) {
      return;
    }

    const newWindow = window.open("", "_blank");

    trackShare("Tweet Assistant");

    const linkToShare = await getLinkToShare();
    const newText = `${fullText} ${linkToShare}`;
    const encodedText = encodeURIComponent(newText);
    newWindow.location = `https://www.assistant.speechifai.tech/?utm_source=platform&text=${encodedText}`;
    newWindow.focus();
  };

  const sharePost = async () => {
    if (!checkFillInTheBlank()) {
      return;
    }

    const linkToShare = await getLinkToShare();
    if (
      !props.strategy.config.textParam &&
      !props.strategy.config.urlParam &&
      mediaType !== "image"
    ) {
      copyText(`${fullText} ${linkToShare}`);
    }

    shareLink(fullText, linkToShare, props.strategy.config).then((ret) => {
      if (ret === 0) {
        trackShare();
      }
    });
  };

  const handleInsert = (e, idx) => {
    let text = e.target.innerHTML;
    var regex = /<br\s*[\/]?>/gi;

    let newInsertText = insertText.slice();
    newInsertText[idx] = text.replace(regex, "\n");
    setInsertText(newInsertText);

    const tempText = reactStringReplace(
      props.text,
      /\[\[(.*?)\]\]/g,
      (match, i) => {
        return newInsertText[(i - 1) / 2];
      }
    );

    const newText = tempText.join("");
    setFullText(addSpace ? `${newText} ${hashtags}` : `${newText}${hashtags}`);
  };

  const downloadMedia = () => {
    downloadFile(media, mediaType);
  };

  async function getLinkToShare() {
    if (mediaType === "video" || mediaType === "gif") {
      return "";
    } else if (mediaType === "youtube") {
      return `https://www.youtube.com/watch?v=${props.youtubeID}`;
    } else if (mediaType === "giphy") {
      return shareBehavior === "shareLink" ? props.image.imageURL : "";
    } else if (parsedLink && isTwitterMediaLink(parsedLink)) {
      return parsedLink;
    } else if (shortenedLink) {
      return shortenedLink;
    } else if (parsedLink) {
      return await dispatch(
        shortenUrl(
          {
            campaignID: props.campaignID,
            url: parsedLink,
            imageID: props.imageID,
            socialNetwork: props.socialNetwork,
            linkCaption: linkCaption,
          },
          state.apiMode
        )
      ).then((res) => {
        setShortenedLink(res);
        return res;
      });
    }
    return "";
  }

  const customizeAndShare = async () => {
    console.log(insertText, "INSERT TEXT");
    if (!checkFillInTheBlank()) {
      return;
    }

    const card = document.getElementById(props.id);
    if (card) {
      const rect = card.getBoundingClientRect();
      setRect(rect);
    }

    var ret = 1;
    if (
      shareBehavior === "nativeWithFile" ||
      shareBehavior === "nativeWithoutFile"
    ) {
      mediaType === "image"
        ? copyText(`${fullText} ${parsedLink}`)
        : copyText(fullText);
      setMediaModalMobile(true);
      return;
    } else if (shareBehavior === "shareLink") {
      // check if text needs to be copied to clipboard
      if (!props.strategy.config.textParam) {
        getLinkToShare();
        copyText(fullText);
        setOpen(true);
        if (state.wp && state.multirow) {
          scrollToTargetAdjusted(`modal-${props.id}`);
        }
        return;
      } else {
        ret = await shareLink(
          fullText,
          await getLinkToShare(),
          props.strategy.config
        );
      }
    } else if (shareBehavior === "downloadMedia") {
      if (!props.strategy.config.textParam) {
        copyText(fullText);
      }
      setMediaModal(true);
      if (state.wp && state.multirow) {
        scrollToTargetAdjusted(`media-modal-${props.id}`);
      }
      downloadMedia();
      return;
    }

    if (ret === 0) {
      trackShare();
    }
  };

  const nativeShare = async () => {
    const linkToShare = await getLinkToShare();
    var ret = 1;
    if (shareBehavior === "nativeWithFile") {
      if (linkToShare) {
        copyText(`${fullText} ${linkToShare}`);
      }

      const textToShare = props.strategy.config.nativeSkipText?.includes(
        props.deviceInfo.os
      )
        ? undefined
        : linkToShare
        ? `${fullText} ${linkToShare}`
        : fullText;

      ret = await shareNativeWithFile(media, mediaType, textToShare);
    } else {
      const textToShare = props.strategy.config.nativeSkipText?.includes(
        props.deviceInfo.os
      )
        ? undefined
        : fullText;
      ret = await shareNativeWithoutFile(textToShare, linkToShare);
    }

    if (ret === 0) {
      trackShare();
    }
  };

  const copyAndDownload = () => {
    if (!checkFillInTheBlank()) {
      return;
    }

    if (mediaType === "gif" || mediaType === "giphy" || mediaType === "video") {
      copyText(fullText);
    } else {
      copyText(`${fullText} ${parsedLink}`);
    }
    trackShare("Copy and Download");
    downloadMedia();
  };

  const onMediaLoadCallback = (e) => {
    if (props.strategy.config[mediaType]) {
      fixMediaSize(
        e.target,
        props.strategy.config[mediaType].minRatio,
        props.strategy.config[mediaType].maxRatio
      );
    } else {
      // keep original aspect ratio
      fixMediaSize(e.target, 0, 0);
    }
  };

  const onVideoLoadCallback = (e) => {
    let htmlImage;
    var parentDiv;

    try {
      htmlImage = document.createElement("img");
      htmlImage.setAttribute("src", e.target.poster);
      htmlImage.style.position = "fixed";
      htmlImage.style.display = "none";

      parentDiv = e.target.parentNode;
      if (parentDiv) {
        parentDiv.appendChild(htmlImage);
        if (props.strategy.config[mediaType]) {
          fixMediaSize(
            htmlImage,
            props.strategy.config[mediaType].minRatio,
            props.strategy.config[mediaType].maxRatio,
            parentDiv
          );
        } else {
          // keep original aspect ratio
          fixMediaSize(htmlImage, 0, 0, parentDiv);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (parentDiv) {
        parentDiv.removeChild(htmlImage);
      }
    }
  };

  const handleEditedTextChange = (newText) => {
    setFullText(newText);
    setEditedText(newText);
  };

  useEffect(() => {
    const currentPost = state.filteredPosts.filter(
      (post) => post.readyMadePost.id === props.id
    );
    if (currentPost) {
      const postLinkCaption = currentPost[0].readyMadePost.linkCaption;
      const facebookTitle = state.readyMadeData.campaign.facebookTitle;
      const tempCaption =
        postLinkCaption === "" ? facebookTitle : postLinkCaption;
      setLinkCaption(tempCaption);
      setLink(currentPost[0].readyMadePost.link);
    }

    const fillInRegex = new RegExp("\\[\\[(.*?)\\]\\]", "g");
    const textRegex = !fillInRegex.test(props.text);
    const matchRegex = props.text.match(fillInRegex);

    if (!textRegex) {
      setFillIn(true);
      setInsertText(Array.from({ length: matchRegex.length }, (v, i) => ""));
    }
  }, []);

  useEffect(() => {
    if (link) {
      var newLink = props.url
        ? props.url
        : props.value
        ? `${link}${props.value}`
        : link;

      if (newLink.substring(0, 2) === "@@") {
        newLink = newLink.slice(2);
        setShortenedLink(newLink);
      }

      if (
        mediaType !== "image" ||
        (!props.strategy.config.urlParam &&
          !props.strategy.config.textParam &&
          props.socialNetwork !== "native")
      ) {
        setDisplayImageFooter(false);
      } else if (
        props.socialNetwork === "twitter" &&
        isTwitterMediaLink(newLink)
      ) {
        setDisplayImageFooter(false);
      } else {
        setDisplayImageFooter(true);
      }

      if (newLink) {
        try {
          const url = new URL(newLink);
          setParsedLink(url.href);
        } catch {
          console.log("Invalid link:", newLink);
          setParsedLink("");
        }
      }
    }
  }, [link]);

  useEffect(() => {
    if (hashtags.length === 0 && !fillIn && !editing) {
      setFullText(props.text);
    }
  }, [fullText]);
  console.log(editedText, "EDITED");

  return (
    <div className="postcard-container">
      <PrimaryCard
        className={!state.wp ? "postcard" : "embed-postcard"}
        id={props.id}
        bgColor={whitelabel.cardBackgroundColor}
        border={
          whitelabel.cardBorderColor
            ? `1px solid ${whitelabel.cardBorderColor}`
            : ""
        }
        radius={whitelabel.cardCornerRadius ? whitelabel.cardCornerRadius : "0"}
        shadow={
          whitelabel.dropShadow
            ? "0px 0px 6px 2px rgba(90, 90, 90, 0.1) !important"
            : "none !important"
        }
        footerBorder={
          whitelabel.pictureFooterBorderColor
            ? `1px solid ${whitelabel.pictureFooterBorderColor}`
            : ""
        }
        cardRadius={
          whitelabel.pictureFooterCornerRadius
            ? whitelabel.pictureFooterCornerRadius
            : "0"
        }
        textcolor={whitelabel.textColor}
        font={whitelabel.fontFamily}
        style={{ "--platform_color": props.strategy.config.color }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {editing ? (
          <div className="post-text">
            <EditableTextContent
              initialText={editedText}
              onChange={handleEditedTextChange}
              onBlur={handleEditedTextChange}
              placeholderText={"Write post text here"}
              platformColor={props.strategy.config.color}
              postID={postID}
              insertText={insertText}
            />
          </div>
        ) : (
          <div className="post-text">
            {isHovered && !isMobile && customText ? (
              <div
                className="edit-btn"
                onClick={() => {
                  if (editedText.match(/\[\[.*?\]\]/)) {
                    dispatch(setEditing(true, props.id));
                  } else {
                    dispatch(setEditing(true, props.id));
                    setFillIn(false);
                  }
                }}
                style={{ "--platform_color": props.strategy.config.color }}
              >
                <Icon name="edit" />
              </div>
            ) : isMobile && customText ? (
              <div
                className="edit-btn"
                onClick={() => dispatch(setEditing(true, props.id))}
                style={{ "--platform_color": props.strategy.config.color }}
              >
                <Icon name="edit" />
              </div>
            ) : null}
            <ReadMore enable={true}>
              {fillIn
                ? reactStringReplace(
                    editedText,
                    /\[\[(.*?)\]\]/g,
                    (match, i) => (
                      <Popup
                        open={popup && popupField === (i - 1) / 2}
                        onClose={() => {
                          setPopup(false);
                        }}
                        onOpen={() => {
                          setPopup(true);
                          setPopupField((i - 1) / 2);
                        }}
                        position="top right"
                        content="Please fill in the blank before sharing"
                        className={`fill-in-the-blank-popup`}
                        style={{
                          "--platform_color": props.strategy.config.color,
                        }}
                        key={i}
                        trigger={
                          <ContentEditableWithRef
                            value={insertText[(i - 1) / 2]}
                            onChange={handleInsert}
                            placeholderText={match.replace(/[\[\]']+/g, "")}
                            index={(i - 1) / 2}
                            platformColor={props.strategy.config.color}
                          />
                        }
                      />
                    )
                  )
                : props.text}
              {addSpace ? <>&nbsp;</> : null}
              <span className="postcard-tags">{hashtags}</span>
            </ReadMore>
          </div>
        )}
        <div className="thumbnail-container">
          <Card>
            {mediaType === "youtube" ? (
              <Embed
                id={props.youtubeID}
                placeholder={media}
                source="youtube"
                className="video"
              />
            ) : mediaType === "video" ? (
              <div className="video-container">
                <video
                  key={media}
                  controls
                  poster={props.image.imageURL}
                  preload="none"
                  onLoadStart={onVideoLoadCallback}
                >
                  <source src={media} id="Sharers Video" />
                </video>
              </div>
            ) : (
              <>
                {mediaType !== "gif" ? (
                  <a
                    href={
                      mediaType === "image" ? parsedLink : props.image.imageURL
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Image
                      src={media}
                      alt="Thumbnail"
                      wrapped
                      ui={false}
                      onLoad={onMediaLoadCallback}
                      className={
                        displayImageFooter
                          ? "generic-thumbnail"
                          : "generic-thumbnail no-footer"
                      }
                    />
                  </a>
                ) : (
                  <Image
                    src={media}
                    alt="Thumbnail"
                    wrapped
                    ui={false}
                    onLoad={onMediaLoadCallback}
                    className={
                      displayImageFooter
                        ? "generic-thumbnail"
                        : "generic-thumbnail no-footer"
                    }
                  />
                )}
              </>
            )}
            {displayImageFooter && (
              <Card.Content>
                <a
                  href={parsedLink}
                  target="_blank"
                  className="postcard-link"
                  rel="noreferrer"
                >
                  <Card.Header className="post-linkcaption">
                    {linkCaption}
                  </Card.Header>
                  <Card.Meta className="post-link">
                    {parsedLink && new URL(parsedLink).hostname}
                  </Card.Meta>
                </a>
              </Card.Content>
            )}
          </Card>
        </div>
        {/* Desktop Modal */}
        <Modal
          onClose={() => setOpen(false)}
          onOpen={() => setOpen(true)}
          open={open}
          id={`modal-${props.id}`}
          className="generic-modal"
          style={{
            "--platform_color": props.strategy.config.color,
            top:
              rect &&
              state.wp &&
              state.multirow &&
              rect.top + rect.height / 2 - 150,
          }}
        >
          <Modal.Header>
            {props.modalTitle ? props.modalTitle : "Text copied"}
          </Modal.Header>
          <Modal.Content>
            <div className="modal-check">
              <Icon name="check" size="huge" />
              <Modal.Description>
                <Header>
                  {props.modalPaste
                    ? props.modalPaste
                    : "Please paste the text after continuing."}
                </Header>
              </Modal.Description>
            </div>
          </Modal.Content>
          <Modal.Actions>
            <Button onClick={() => sharePost()}>
              {props.modalButton
                ? `${props.modalButton} ${props.strategy.config.platformName}`
                : `Continue to ${props.strategy.config.platformName}`}
            </Button>
          </Modal.Actions>
        </Modal>
        <Modal
          onClose={() => setMediaModal(false)}
          onOpen={() => setMediaModal(true)}
          open={mediaModal}
          id={`media-modal-${props.id}`}
          className="generic-modal"
          style={{
            "--platform_color": props.strategy.config.color,
            top:
              rect &&
              state.wp &&
              state.multirow &&
              rect.top + rect.height / 2 - 150,
          }}
        >
          <Modal.Header>
            {props.modalTitle ? props.modalTitle : "Text copied"}
          </Modal.Header>
          <Modal.Content>
            <div className="modal-check">
              <Modal.Description>
                <Header>
                  Follow these steps to create a post: <br />
                  1. Click on the button below to open{" "}
                  {props.strategy.config.platformName} <br />
                  {props.socialNetwork === "instagram" ? (
                    <>
                      2. Click on {instagramIcon} in the header menu <br />
                      3. Select your downloaded file <br />
                      4. Paste the text in the text box
                    </>
                  ) : (
                    <>
                      2. Select your downloaded file <br />
                      {!props.strategy.config.textParam && (
                        <>3. Paste the caption in the text box</>
                      )}
                    </>
                  )}
                </Header>
              </Modal.Description>
            </div>
          </Modal.Content>
          <Modal.Actions>
            <Button onClick={sharePost}>
              {props.modalButton
                ? `${props.modalButton} ${props.strategy.config.platformName}`
                : "Continue to " + props.strategy.config.platformName}
            </Button>
          </Modal.Actions>
        </Modal>
        {/* Mobile Modal */}
        <Modal
          onClose={() => setMediaModalMobile(false)}
          onOpen={() => setMediaModalMobile(true)}
          open={mediaModalMobile}
          className="generic-modal-mobile"
          style={{ "--platform_color": props.strategy.config.color }}
        >
          <Modal.Header>
            {props.modalTitle ? props.modalTitle : "Text copied"}
          </Modal.Header>
          <Modal.Content>
            <div className="modal-check">
              <Modal.Description>
                <Header>
                  <>
                    Follow these 3 steps to create a post: <br />
                    1. Click the button below to open you phone's share menu.{" "}
                    <br />
                    2. Select the {props.strategy.config.platformName} app{" "}
                    <br />
                    3. Paste the caption in the text box
                  </>
                </Header>
              </Modal.Description>
            </div>
          </Modal.Content>
          <Modal.Actions>
            <Button onClick={nativeShare}>
              {props.modalButton
                ? `${props.modalButton} ${props.strategy.config.platformName}`
                : "Continue to " + props.strategy.config.platformName}
            </Button>
          </Modal.Actions>
        </Modal>
        <ButtonContainer
          className="postcard-buttons"
          radius={whitelabel.buttonCornerRadius}
          font={whitelabel.fontFamily}
        >
          <Button
            onClick={customizeAndShare}
            id={`button-${props.id}`}
            className={
              props.youtubeID === "" ? "generic-btn combined" : "generic-btn"
            }
            radius={whitelabel.buttonCornerRadius}
            font={whitelabel.fontFamily}
            title={props.share ? props.share : "Customize and share"}
          >
            {props.share ? props.share : "Customize and share"}
          </Button>
          {props.youtubeID === "" && (
            <Dropdown
              className="generic-btn-dropdown"
              scrolling={state.wp ? true : false}
              direction="left"
            >
              <Dropdown.Menu>
                {props.strategy.config.optimizeButtonAvailable &&
                  props.optimizeTweet && (
                    <Dropdown.Item
                      text="Optimize and Tweet"
                      onClick={optimize}
                    />
                  )}
                <Dropdown.Item
                  text="Copy and download"
                  onClick={copyAndDownload}
                />
              </Dropdown.Menu>
            </Dropdown>
          )}
        </ButtonContainer>
      </PrimaryCard>
    </div>
  );
};

export default GenericPostCard;
