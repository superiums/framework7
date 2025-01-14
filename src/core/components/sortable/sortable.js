import { getDocument } from 'ssr-window';
import $ from '../../shared/dom7';
import { bindMethods } from '../../shared/utils';
import { getSupport } from '../../shared/get-support';

const Sortable = {
  init() {
    const app = this;
    const document = getDocument();
    let isTouched;
    let isMoved;
    let touchStartY;
    let touchesDiff;
    let $sortingEl;
    let $sortingItems;
    let $sortableContainer;
    let sortingElHeight;
    let minTop;
    let maxTop;
    let $insertAfterEl;
    let $insertBeforeEl;
    let indexFrom;
    let $pageEl;
    let $pageContentEl;
    let pageHeight;
    let pageOffset;
    let sortingElOffsetLocal;
    let sortingElOffsetTop;
    let initialScrollTop;
    let wasTapHold;

    function handleTouchStart(e, isTapHold) {
      isMoved = false;
      isTouched = true;
      wasTapHold = false;
      touchStartY = e.type === 'touchstart' ? e.targetTouches[0].pageY : e.pageY;
      $sortingEl = $(e.target).closest('li').eq(0);
      indexFrom = $sortingEl.index();
      $sortableContainer = $sortingEl.parents('.sortable');
      const $listGroup = $sortingEl.parents('.list-group');
      if ($listGroup.length && $listGroup.parents($sortableContainer).length) {
        $sortableContainer = $listGroup;
      }
      $sortingItems = $sortableContainer
        .children('ul')
        .children('li:not(.disallow-sorting):not(.no-sorting)');
      if (app.panel) app.panel.allowOpen = false;
      if (app.swipeout) app.swipeout.allow = false;
      if (isTapHold) {
        $sortingEl.addClass('sorting');
        $sortableContainer.addClass('sortable-sorting');
        wasTapHold = true;
      }
    }
    function handleTouchMove(e) {
      if (!isTouched || !$sortingEl) return;
      const pageY = e.type === 'touchmove' ? e.targetTouches[0].pageY : e.pageY;
      if (!isMoved) {
        $pageEl = $sortingEl.parents('.page');
        $pageContentEl = $sortingEl.parents('.page-content');
        const paddingTop = parseInt($pageContentEl.css('padding-top'), 10);
        const paddingBottom = parseInt($pageContentEl.css('padding-bottom'), 10);
        initialScrollTop = $pageContentEl[0].scrollTop;
        pageOffset = $pageEl.offset().top + paddingTop;
        pageHeight = $pageEl.height() - paddingTop - paddingBottom;
        $sortingEl.addClass('sorting');
        $sortableContainer.addClass('sortable-sorting');
        sortingElOffsetLocal = $sortingEl[0].offsetTop;
        minTop = $sortingEl[0].offsetTop;
        maxTop = $sortingEl.parent().height() - sortingElOffsetLocal - $sortingEl.height();
        sortingElHeight = $sortingEl[0].offsetHeight;
        sortingElOffsetTop = $sortingEl.offset().top;
      }
      isMoved = true;

      e.preventDefault();
      e.f7PreventSwipePanel = true;

      touchesDiff = pageY - touchStartY;

      const translateScrollOffset = $pageContentEl[0].scrollTop - initialScrollTop;
      const translate = Math.min(Math.max(touchesDiff + translateScrollOffset, -minTop), maxTop);
      $sortingEl.transform(`translate3d(0,${translate}px,0)`);

      const scrollAddition = 44;
      let allowScroll = true;
      if (touchesDiff + translateScrollOffset + scrollAddition < -minTop) {
        allowScroll = false;
      }
      if (touchesDiff + translateScrollOffset - scrollAddition > maxTop) {
        allowScroll = false;
      }

      $insertBeforeEl = undefined;
      $insertAfterEl = undefined;

      let scrollDiff;
      if (allowScroll) {
        if (
          sortingElOffsetTop + touchesDiff + sortingElHeight + scrollAddition >
          pageOffset + pageHeight
        ) {
          // To Bottom
          scrollDiff =
            sortingElOffsetTop +
            touchesDiff +
            sortingElHeight +
            scrollAddition -
            (pageOffset + pageHeight);
        }
        if (sortingElOffsetTop + touchesDiff < pageOffset + scrollAddition) {
          // To Top
          scrollDiff = sortingElOffsetTop + touchesDiff - pageOffset - scrollAddition;
        }
        if (scrollDiff) {
          $pageContentEl[0].scrollTop += scrollDiff;
        }
      }

      $sortingItems.each((el) => {
        const $currentEl = $(el);
        if ($currentEl[0] === $sortingEl[0]) return;
        const currentElOffset = $currentEl[0].offsetTop;
        const currentElHeight = $currentEl.height();
        const sortingElOffset = sortingElOffsetLocal + translate;

        let currentTranslate;
        const prevTranslate = $currentEl[0].f7Translate;

        if (
          sortingElOffset >= currentElOffset - currentElHeight / 2 &&
          $sortingEl.index() < $currentEl.index()
        ) {
          currentTranslate = -sortingElHeight;
          $currentEl.transform(`translate3d(0, ${currentTranslate}px,0)`);
          $insertAfterEl = $currentEl;
          $insertBeforeEl = undefined;
        } else if (
          sortingElOffset <= currentElOffset + currentElHeight / 2 &&
          $sortingEl.index() > $currentEl.index()
        ) {
          currentTranslate = sortingElHeight;
          $currentEl[0].f7Translate = currentTranslate;
          $currentEl.transform(`translate3d(0, ${currentTranslate}px,0)`);
          $insertAfterEl = undefined;
          if (!$insertBeforeEl) $insertBeforeEl = $currentEl;
        } else {
          currentTranslate = undefined;
          $currentEl.transform('translate3d(0, 0%,0)');
        }

        if (prevTranslate !== currentTranslate) {
          $currentEl.trigger('sortable:move');
          app.emit('sortableMove', $currentEl[0], $sortableContainer[0]);
        }

        $currentEl[0].f7Translate = currentTranslate;
      });
    }
    function handleTouchEnd() {
      if (!isTouched || !isMoved) {
        if (isTouched && !isMoved) {
          if (app.panel) app.panel.allowOpen = true;
          if (app.swipeout) app.swipeout.allow = true;
          if (wasTapHold) {
            $sortingEl.removeClass('sorting');
            $sortableContainer.removeClass('sortable-sorting');
          }
        }
        isTouched = false;
        isMoved = false;
        return;
      }
      if (app.panel) app.panel.allowOpen = true;
      if (app.swipeout) app.swipeout.allow = true;

      $sortingItems.transform('');
      $sortingEl.removeClass('sorting');
      $sortableContainer.removeClass('sortable-sorting');

      let indexTo;
      if ($insertAfterEl) indexTo = $insertAfterEl.index();
      else if ($insertBeforeEl) indexTo = $insertBeforeEl.index();

      let moveElements = $sortableContainer.dataset().sortableMoveElements;
      if (typeof moveElements === 'undefined') {
        moveElements = app.params.sortable.moveElements;
      }

      if (moveElements) {
        if ($insertAfterEl) {
          $sortingEl.insertAfter($insertAfterEl);
        }
        if ($insertBeforeEl) {
          $sortingEl.insertBefore($insertBeforeEl);
        }
      }

      if (($insertAfterEl || $insertBeforeEl) && $sortableContainer.hasClass('virtual-list')) {
        indexFrom = $sortingEl[0].f7VirtualListIndex;
        if (typeof indexFrom === 'undefined')
          indexFrom = $sortingEl.attr('data-virtual-list-index');
        if ($insertBeforeEl) {
          indexTo = $insertBeforeEl[0].f7VirtualListIndex;
          if (typeof indexTo === 'undefined')
            indexTo = $insertBeforeEl.attr('data-virtual-list-index');
        } else {
          indexTo = $insertAfterEl[0].f7VirtualListIndex;
          if (typeof indexTo === 'undefined')
            indexTo = $insertAfterEl.attr('data-virtual-list-index');
        }
        if (indexTo !== null) indexTo = parseInt(indexTo, 10);
        else indexTo = undefined;

        const virtualList = $sortableContainer[0].f7VirtualList;

        if (indexFrom) indexFrom = parseInt(indexFrom, 10);
        if (indexTo) indexTo = parseInt(indexTo, 10);
        if (virtualList) virtualList.moveItem(indexFrom, indexTo);
      }
      if (typeof indexTo !== 'undefined' && !Number.isNaN(indexTo) && indexTo !== indexFrom) {
        $sortingEl.trigger('sortable:sort', { from: indexFrom, to: indexTo });
        app.emit(
          'sortableSort',
          $sortingEl[0],
          { from: indexFrom, to: indexTo, el: $sortingEl[0] },
          $sortableContainer[0],
        );
      }

      $insertBeforeEl = undefined;
      $insertAfterEl = undefined;
      isTouched = false;
      isMoved = false;
    }

    const activeListener = getSupport().passiveListener
      ? { passive: false, capture: false }
      : false;

    $(document).on(
      app.touchEvents.start,
      '.list.sortable .sortable-handler',
      handleTouchStart,
      activeListener,
    );
    app.on('touchmove:active', handleTouchMove);
    app.on('touchend:passive', handleTouchEnd);

    $(document).on('taphold', '.sortable-tap-hold', (e, pointerEvent) => {
      handleTouchStart(pointerEvent, true);
    });
  },
  enable(el = '.list.sortable') {
    const app = this;
    const $el = $(el);
    if ($el.length === 0) return;
    $el.addClass('sortable-enabled');
    $el.trigger('sortable:enable');
    app.emit('sortableEnable', $el[0]);
  },
  disable(el = '.list.sortable') {
    const app = this;
    const $el = $(el);
    if ($el.length === 0) return;
    $el.removeClass('sortable-enabled');
    $el.trigger('sortable:disable');
    app.emit('sortableDisable', $el[0]);
  },
  toggle(el = '.list.sortable') {
    const app = this;
    const $el = $(el);
    if ($el.length === 0) return;
    if ($el.hasClass('sortable-enabled')) {
      app.sortable.disable($el);
    } else {
      app.sortable.enable($el);
    }
  },
};
export default {
  name: 'sortable',
  params: {
    sortable: {
      moveElements: true,
    },
  },
  create() {
    const app = this;
    bindMethods(app, {
      sortable: Sortable,
    });
  },
  on: {
    init() {
      const app = this;
      if (!app.params.sortable) return;
      app.sortable.init();
    },
  },
  clicks: {
    '.sortable-enable': function enable($clickedEl, data = {}) {
      const app = this;
      app.sortable.enable(data.sortable);
    },
    '.sortable-disable': function disable($clickedEl, data = {}) {
      const app = this;
      app.sortable.disable(data.sortable);
    },
    '.sortable-toggle': function toggle($clickedEl, data = {}) {
      const app = this;
      app.sortable.toggle(data.sortable);
    },
  },
};
