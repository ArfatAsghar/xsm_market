/**
 * Navigation utility functions
 */

/**
 * Scrolls to the top of the page with smooth animation
 */
export const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/**
 * Navigate to a page and scroll to top
 * @param setCurrentPage - Function to set the current page
 * @param page - Page to navigate to
 */
export const navigateAndScrollToTop = (setCurrentPage: (page: string) => void, page: string) => {
  setCurrentPage(page);
  scrollToTop();
};
